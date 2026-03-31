export type CourseRecord = {
  id?: string;
  name?: string;
  address?: string | null;
  city?: string;
  state?: string;
  country?: string;
  difficulty?: string | null;
  course_rating?: number | string | null;
  slope_rating?: number | string | null;
  amenities?: string[] | string | Record<string, boolean> | null;
  images?: string[] | Array<{ url?: string | null }> | null;
  image_url?: string | null;
  hero_image_url?: string | null;
};

export type SearchCoursesArgs = {
  location?: string;
  radius_km?: number;
  query?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const DEFAULT_RADIUS_KM = 50;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function sanitizeLimit(limit?: number): number {
  if (typeof limit !== "number" || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

function sanitizeRadius(radius_km?: number): number {
  if (typeof radius_km !== "number" || Number.isNaN(radius_km)) {
    return DEFAULT_RADIUS_KM;
  }

  return Math.max(1, radius_km);
}

function normalizeAmenities(value: CourseRecord["amenities"]): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([name]) => name);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeDifficulty(value: string | null | undefined): "easy" | "moderate" | "challenging" {
  if (value === "easy" || value === "moderate" || value === "challenging") {
    return value;
  }

  return "moderate";
}

function normalizeImageUrl(course: CourseRecord): string | null {
  if (course.image_url) {
    return course.image_url;
  }

  if (course.hero_image_url) {
    return course.hero_image_url;
  }

  if (Array.isArray(course.images)) {
    const firstImage = course.images.find((image) => {
      if (typeof image === "string") {
        return image.length > 0;
      }

      return typeof image?.url === "string" && image.url.length > 0;
    });

    if (typeof firstImage === "string") {
      return firstImage;
    }

    return firstImage?.url ?? null;
  }

  return null;
}

export function mapCourse(course: CourseRecord) {
  return {
    id: course.id ?? course.name ?? "unknown-course",
    name: course.name ?? "Unknown Course",
    city: course.city ?? "",
    state: course.state ?? "",
    country: course.country ?? "",
    difficulty: normalizeDifficulty(course.difficulty),
    course_rating: Number(course.course_rating ?? 0),
    slope_rating: Number(course.slope_rating ?? 0),
    amenities: normalizeAmenities(course.amenities),
    image_url: normalizeImageUrl(course)
  };
}

async function fetchJson(url: URL): Promise<unknown> {
  const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");
  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function fetchFromEdgeFunction(args: SearchCoursesArgs) {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const url = new URL("/functions/v1/courses-list", supabaseUrl);

  if (args.location) {
    url.searchParams.set("location", args.location);
  }
  if (args.query) {
    url.searchParams.set("query", args.query);
  }

  url.searchParams.set("radius_km", String(sanitizeRadius(args.radius_km)));
  url.searchParams.set("limit", String(sanitizeLimit(args.limit)));

  const payload = await fetchJson(url);

  if (Array.isArray(payload)) {
    return payload as CourseRecord[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as { courses?: unknown; data?: unknown };
    if (Array.isArray(record.courses)) {
      return record.courses as CourseRecord[];
    }
    if (Array.isArray(record.data)) {
      return record.data as CourseRecord[];
    }
  }

  return [];
}

async function fetchFromRest(args: SearchCoursesArgs) {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const url = new URL("/rest/v1/golf_courses", supabaseUrl);

  url.searchParams.set("select", "id,name,address,city,state,country,difficulty,course_rating,slope_rating,amenities,images,is_verified,is_active");
  url.searchParams.set("is_verified", "eq.true");
  url.searchParams.set("is_active", "eq.true");
  url.searchParams.set("limit", String(sanitizeLimit(args.limit)));

  if (args.query) {
    const query = `%${args.query}%`;
    url.searchParams.set("or", `(name.ilike.${query},address.ilike.${query},city.ilike.${query},state.ilike.${query})`);
  }

  if (args.location) {
    const [city, state] = args.location.split(",").map((part) => part.trim()).filter(Boolean);
    if (city) {
      url.searchParams.set("city", `ilike.${city}`);
    }
    if (state) {
      url.searchParams.set("state", `ilike.${state}`);
    }
  }

  const payload = await fetchJson(url);
  return Array.isArray(payload) ? (payload as CourseRecord[]) : [];
}

export async function searchCourses(args: SearchCoursesArgs) {
  try {
    return await fetchFromEdgeFunction(args);
  } catch (error) {
    console.warn("Falling back to direct REST course search:", error);
    return fetchFromRest(args);
  }
}
