import { mapCourse, searchCourses, type SearchCoursesArgs } from "../lib/supabase.js";

export const searchGolfCourses = {
  name: "search_golf_courses",
  description: "Search verified golf courses by location or name",
  inputSchema: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City and state, e.g. 'Scottsdale, AZ'"
      },
      radius_km: {
        type: "number",
        description: "Search radius in kilometers (default: 50)"
      },
      query: {
        type: "string",
        description: "Text search on course name or address"
      },
      limit: {
        type: "number",
        description: "Max results (default: 10, max: 50)"
      }
    }
  }
} as const;

export async function searchGolfCoursesHandler(args: SearchCoursesArgs = {}) {
  const courses = await searchCourses(args);
  const payload = { courses: courses.map(mapCourse) };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}
