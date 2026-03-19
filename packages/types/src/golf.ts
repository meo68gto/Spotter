// ============================================================================
// Golf Domain Types - Sprint 2 Complete Type Definitions
// ============================================================================

import type { UUID } from "./index.js";

// ============================================================================
// Course Types
// ============================================================================

/**
 * Difficulty level of a golf course
 */
export type CourseDifficulty = 'easy' | 'moderate' | 'challenging' | 'expert';

/**
 * Geographic coordinates and address for a course location
 */
export interface CourseLocation {
  /** Latitude coordinate */
  lat: number;
  /** Longitude coordinate */
  lng: number;
  /** Street address */
  address?: string;
  /** City name */
  city: string;
  /** State/Province */
  state?: string;
  /** ZIP/Postal code */
  zipCode?: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
}

/**
 * Course image metadata
 */
export interface CourseImage {
  /** Image URL */
  url: string;
  /** Optional caption for the image */
  caption?: string;
  /** Whether this is the primary/cover image */
  isPrimary: boolean;
}

/**
 * Amenities available at a golf course
 */
export interface CourseAmenities {
  /** Practice driving range available */
  drivingRange: boolean;
  /** Pro shop on-site */
  proShop: boolean;
  /** Restaurant or dining facilities */
  restaurant: boolean;
  /** Bar or lounge */
  bar: boolean;
  /** Snack bar or halfway house */
  snackBar: boolean;
  /** Locker rooms available */
  lockerRooms: boolean;
  /** Cart rental available */
  cartRental: boolean;
  /** Club rental available */
  clubRental: boolean;
  /** Caddie services available */
  caddieService: boolean;
  /** Golf lessons available */
  lessons: boolean;
  /** Putting green available */
  puttingGreen: boolean;
  /** Chipping area available */
  chippingArea: boolean;
  /** Bunker practice area */
  practiceBunker: boolean;
  /** Golf cart GPS */
  cartGPS: boolean;
  /** Electronic scorecards */
  electronicScorecards: boolean;
  /** Spa facilities */
  spa?: boolean;
  /** Fitness center */
  fitnessCenter?: boolean;
  /** Swimming pool */
  pool?: boolean;
  /** Conference/meeting facilities */
  conferenceFacilities?: boolean;
  /** Wedding/event facilities */
  eventFacilities?: boolean;
}

/**
 * Full golf course interface
 */
export interface GolfCourse {
  /** Unique identifier for the course */
  id: UUID;
  /** Course name */
  name: string;
  /** Course description */
  description?: string;
  /** Location data (coordinates + address) */
  location: CourseLocation;
  /** Contact phone number */
  phone?: string;
  /** Course website URL */
  websiteUrl?: string;
  /** Tee time booking URL */
  bookingUrl?: string;
  /** Email contact */
  email?: string;
  /** Number of holes (typically 9, 18, or 27) */
  holes: number;
  /** Total course par */
  par: number;
  /** Total yardage from longest tees */
  totalYards?: number;
  /** Course rating (difficulty rating, typically 67-77) */
  courseRating?: number;
  /** Slope rating (difficulty for bogey golfer, typically 55-155) */
  slopeRating?: number;
  /** Course difficulty level */
  difficulty?: CourseDifficulty;
  /** Whether the course is public or private */
  isPublic: boolean;
  /** Year course was established/built */
  yearEstablished?: number;
  /** Course designer/architect */
  designer?: string;
  /** Available amenities */
  amenities: CourseAmenities;
  /** Course images */
  images?: CourseImage[];
  /** Whether the course is active and available for play */
  active: boolean;
  /** Average round duration in minutes (default 240) */
  averageRoundDurationMinutes?: number;
  /** Timezone for the course location */
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Round Types
// ============================================================================

/**
 * Round format/gametype options
 */
export type RoundFormat = 'stroke_play' | 'match_play' | 'scramble' | 'best_ball' | 'shamble';

/**
 * Round status in the system
 */
export type RoundStatus = 'draft' | 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Full golf round/foursome interface
 */
export interface GolfRound {
  /** Unique identifier for the round */
  id: UUID;
  /** Reference to the course where the round is played */
  courseId: UUID;
  /** Round title/name (e.g., "Weekend Golf at Pebble") */
  title?: string;
  /** Round description/notes */
  description?: string;
  /** Scheduled date and start time (ISO 8601) */
  scheduledAt: string;
  /** Expected end time (ISO 8601) */
  expectedEndAt: string;
  /** Round format/gametype */
  format: RoundFormat;
  /** Maximum number of participants (typically 4) */
  maxParticipants: number;
  /** Current status of the round */
  status: RoundStatus;
  /** Reference to user who created the round */
  createdBy: UUID;
  /** Whether round requires approval to join */
  requiresApproval: boolean;
  /** Minimum handicap required to join (optional) */
  minHandicap?: number;
  /** Maximum handicap allowed to join (optional) */
  maxHandicap?: number;
  /** Tee time booking reference (if applicable) */
  teeTimeReference?: string;
  /** Whether scores will be tracked for this round */
  trackScores: boolean;
  /** Entry fee in cents (optional) */
  entryFeeCents?: number;
  /** Currency code (ISO 4217) */
  currency?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Filters for searching/filtering rounds
 */
export interface RoundFilters {
  /** Filter by course ID */
  courseId?: UUID;
  /** Filter by creator user ID */
  createdBy?: UUID;
  /** Filter by round format */
  format?: RoundFormat;
  /** Filter by status */
  status?: RoundStatus;
  /** Filter by date range start (ISO 8601) */
  dateFrom?: string;
  /** Filter by date range end (ISO 8601) */
  dateTo?: string;
  /** Filter by location - latitude */
  lat?: number;
  /** Filter by location - longitude */
  lng?: number;
  /** Filter by location radius in km */
  radiusKm?: number;
  /** Filter by handicap range - min */
  minHandicap?: number;
  /** Filter by handicap range - max */
  maxHandicap?: number;
  /** Filter by public/private status */
  isPublic?: boolean;
  /** Text search query */
  query?: string;
  /** Maximum results to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Golf round with joined course data
 */
export interface RoundWithCourse extends GolfRound {
  /** Joined course data */
  course: GolfCourse;
  /** Current participant count */
  participantCount: number;
  /** Whether the requesting user is already a participant */
  isParticipant?: boolean;
  /** Requesting user's participant status if applicable */
  myStatus?: ParticipantStatus;
}

// ============================================================================
// Participant Types
// ============================================================================

/**
 * Status of a participant in a round
 */
export type ParticipantStatus = 'invited' | 'confirmed' | 'declined' | 'waitlisted' | 'checked_in' | 'no_show';

/**
 * Role of a participant in a round
 */
export type ParticipantRole = 'organizer' | 'participant';

/**
 * Round participant interface
 */
export interface RoundParticipant {
  /** Unique identifier for the participant record */
  id: UUID;
  /** Reference to the round */
  roundId: UUID;
  /** Reference to the member/user */
  memberId: UUID;
  /** Participant's role in this round */
  role: ParticipantRole;
  /** Current status */
  status: ParticipantStatus;
  /** User's handicap at time of joining */
  handicapAtJoin?: number;
  /** Whether scores are being tracked for this participant */
  trackScores: boolean;
  /** Final score (if round completed and scores tracked) */
  finalScore?: number;
  /** Net score after handicap adjustment */
  netScore?: number;
  /** Tee played from */
  teePlayed?: string;
  /** Additional notes */
  notes?: string;
  /** Time participant joined/was invited */
  joinedAt: string;
  /** Time status was last updated */
  statusUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Round participant with joined member data
 */
export interface ParticipantWithMember extends RoundParticipant {
  /** Joined member/user data */
  member: {
    id: UUID;
    displayName: string;
    avatarUrl?: string;
    currentHandicap?: number;
    homeCourseId?: UUID;
  };
}

// ============================================================================
// Invite Types
// ============================================================================

/**
 * Invite status for private round invitations
 */
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/**
 * Private round invitation interface
 */
export interface RoundInvite {
  /** Unique identifier for the invite */
  id: UUID;
  /** Reference to the round */
  roundId: UUID;
  /** Reference to the user who sent the invite */
  invitedBy: UUID;
  /** Reference to the invited user (null if invite by email) */
  inviteeId?: UUID;
  /** Email address for external invites */
  inviteeEmail?: string;
  /** Current invite status */
  status: InviteStatus;
  /** Custom message from inviter */
  message?: string;
  /** Expiration time for the invite */
  expiresAt?: string;
  /** Time invite was accepted/declined */
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Stats Types
// ============================================================================

/**
 * Historical handicap entry
 */
export interface HandicapTrend {
  /** Date of the handicap record */
  date: string;
  /** Handicap index at that date */
  index: number;
  /** Associated round ID if from a specific round */
  roundId?: UUID;
}

/**
 * Course preference with play count
 */
export interface CoursePreference {
  /** Reference to the course */
  courseId: UUID;
  /** Course name (denormalized) */
  courseName: string;
  /** Course city (denormalized) */
  courseCity?: string;
  /** Number of times played */
  playCount: number;
  /** Average score at this course */
  averageScore?: number;
  /** Best score at this course */
  bestScore?: number;
  /** Last played date */
  lastPlayedAt?: string;
  /** Is this a favorite course */
  isFavorite: boolean;
}

/**
 * Member golf statistics and handicap tracking
 */
export interface MemberGolfStats {
  /** Unique identifier for the stats record */
  id: UUID;
  /** Reference to the member */
  memberId: UUID;
  /** Current handicap index */
  currentHandicap?: number;
  /** Handicap system used (USGA, WHS, etc.) */
  handicapSystem?: string;
  /** GHIN number if applicable */
  ghinNumber?: string;
  /** Low handicap index (best 12-month rolling) */
  lowHandicap?: number;
  /** Trend direction (improving/declining) */
  trendDirection?: 'improving' | 'stable' | 'declining';
  /** Total rounds played */
  totalRounds: number;
  /** Rounds played in last 12 months */
  roundsLast12Months: number;
  /** Average score across all rounds */
  averageScore?: number;
  /** Best score ever recorded */
  bestScore?: number;
  /** Average putts per round */
  averagePutts?: number;
  /** Greens in regulation percentage */
  girPercentage?: number;
  /** Fairways in regulation percentage */
  fairwayPercentage?: number;
  /** Scramble/up-and-down percentage */
  scramblePercentage?: number;
  /** Sand save percentage */
  sandSavePercentage?: number;
  /** Historical handicap data */
  handicapHistory: HandicapTrend[];
  /** Favorite/preferred courses */
  coursePreferences: CoursePreference[];
  /** Last calculated/updated timestamp */
  lastCalculatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for creating a new round
 */
export interface CreateRoundInput {
  /** Course ID where the round takes place */
  courseId: UUID;
  /** Round title/name (optional, defaults to course name) */
  title?: string;
  /** Round description/notes */
  description?: string;
  /** Scheduled date and time (ISO 8601) */
  scheduledAt: string;
  /** Round format (defaults to stroke_play) */
  format?: RoundFormat;
  /** Maximum participants (defaults to 4) */
  maxParticipants?: number;
  /** Whether round requires approval to join */
  requiresApproval?: boolean;
  /** Minimum handicap to join */
  minHandicap?: number;
  /** Maximum handicap to join */
  maxHandicap?: number;
  /** Whether to track scores */
  trackScores?: boolean;
  /** Entry fee in cents */
  entryFeeCents?: number;
  /** Currency code */
  currency?: string;
  /** Initial participant IDs to invite */
  inviteeIds?: UUID[];
  /** External emails to invite */
  inviteeEmails?: string[];
}

/**
 * Input for updating an existing round
 */
export interface UpdateRoundInput {
  /** Updated title */
  title?: string;
  /** Updated description */
  description?: string;
  /** Updated scheduled time */
  scheduledAt?: string;
  /** Updated format */
  format?: RoundFormat;
  /** Updated max participants */
  maxParticipants?: number;
  /** Updated status */
  status?: RoundStatus;
  /** Updated handicap requirements */
  minHandicap?: number | null;
  /** Updated max handicap */
  maxHandicap?: number | null;
  /** Updated approval requirement */
  requiresApproval?: boolean;
  /** Updated tracking preference */
  trackScores?: boolean;
  /** Updated entry fee */
  entryFeeCents?: number | null;
}

/**
 * Input for joining an open round
 */
export interface JoinRoundInput {
  /** Round ID to join */
  roundId: UUID;
  /** Optional message to organizer */
  message?: string;
  /** Tee preference */
  preferredTee?: string;
}

/**
 * Input for inviting members to a round
 */
export interface InviteToRoundInput {
  /** Round ID to invite to */
  roundId: UUID;
  /** User IDs of members to invite */
  memberIds?: UUID[];
  /** External email addresses to invite */
  emails?: string[];
  /** Custom invitation message */
  message?: string;
  /** Expiration time for the invite (ISO 8601) */
  expiresAt?: string;
}

/**
 * Input for recording round scores
 */
export interface RecordScoreInput {
  /** Round ID */
  roundId: UUID;
  /** Participant ID (if recording for another participant) */
  participantId?: UUID;
  /** Hole-by-hole scores */
  holeScores: number[];
  /** Hole-by-hole putts (optional) */
  holePutts?: number[];
  /** Hole-by-hole fairway results (optional) */
  holeFairways?: Array<'hit' | 'left' | 'right' | 'na'>;
  /** Hole-by-hole GIR status (optional) */
  holeGirs?: boolean[];
  /** Tee played from */
  teePlayed?: string;
  /** Weather conditions during round */
  weatherConditions?: 'sunny' | 'cloudy' | 'rainy' | 'windy' | 'foggy' | 'mixed';
  /** Round notes */
  notes?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * All round format options with descriptions
 */
export const ROUND_FORMATS: Record<RoundFormat, { label: string; description: string; teamBased: boolean }> = {
  stroke_play: {
    label: 'Stroke Play',
    description: 'Traditional scoring where the total number of strokes determines the winner',
    teamBased: false,
  },
  match_play: {
    label: 'Match Play',
    description: 'Hole-by-hole competition where the player with the lowest score on each hole wins the hole',
    teamBased: false,
  },
  scramble: {
    label: 'Scramble',
    description: 'Team format where all players tee off and the best shot is selected for the next shot',
    teamBased: true,
  },
  best_ball: {
    label: 'Best Ball',
    description: 'Team format where the lowest score among teammates counts for each hole',
    teamBased: true,
  },
  shamble: {
    label: 'Shamble',
    description: 'Hybrid format where all tee off, best drive is selected, then individual play from there',
    teamBased: true,
  },
};

/**
 * All round status options
 */
export const ROUND_STATUSES: Record<RoundStatus, { label: string; description: string; isActive: boolean }> = {
  draft: {
    label: 'Draft',
    description: 'Round is being created and not yet published',
    isActive: false,
  },
  open: {
    label: 'Open',
    description: 'Round is published and accepting participants',
    isActive: true,
  },
  full: {
    label: 'Full',
    description: 'Round has reached maximum participants',
    isActive: true,
  },
  in_progress: {
    label: 'In Progress',
    description: 'Round is currently being played',
    isActive: true,
  },
  completed: {
    label: 'Completed',
    description: 'Round has finished',
    isActive: false,
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Round was cancelled by organizer',
    isActive: false,
  },
};

/**
 * Default round duration in minutes (4 hours)
 */
export const DEFAULT_ROUND_DURATION = 240;

/**
 * Standard foursome size
 */
export const FOURSOME_SIZE = 4;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Validates if a string is a valid RoundFormat
 */
export function isValidRoundFormat(format: string): format is RoundFormat {
  return ['stroke_play', 'match_play', 'scramble', 'best_ball', 'shamble'].includes(format);
}

/**
 * Validates if a string is a valid RoundStatus
 */
export function isValidRoundStatus(status: string): status is RoundStatus {
  return ['draft', 'open', 'full', 'in_progress', 'completed', 'cancelled'].includes(status);
}

/**
 * Validates if a string is a valid ParticipantStatus
 */
export function isValidParticipantStatus(status: string): status is ParticipantStatus {
  return ['invited', 'confirmed', 'declined', 'waitlisted', 'checked_in', 'no_show'].includes(status);
}

/**
 * Validates if a string is a valid CourseDifficulty
 */
export function isValidCourseDifficulty(difficulty: string): difficulty is CourseDifficulty {
  return ['easy', 'moderate', 'challenging', 'expert'].includes(difficulty);
}

/**
 * Validates if a string is a valid ParticipantRole
 */
export function isValidParticipantRole(role: string): role is ParticipantRole {
  return ['organizer', 'participant'].includes(role);
}

/**
 * Validates if a string is a valid InviteStatus
 */
export function isValidInviteStatus(status: string): status is InviteStatus {
  return ['pending', 'accepted', 'declined', 'expired'].includes(status);
}

// ============================================================================
// Legacy Types (for backward compatibility during migration)
// ============================================================================

/**
 * Legacy Course interface - use GolfCourse instead
 * @deprecated Use GolfCourse instead
 */
export interface Course {
  /** Unique identifier for the course */
  id: UUID;
  /** Course name */
  name: string;
  /** Course address */
  address: string;
  /** City where the course is located */
  city: string;
  /** State/Province */
  state?: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
  /** Geographic coordinates */
  location: {
    latitude: number;
    longitude: number;
  };
  /** Number of holes (typically 9, 18, or 27) */
  holes: number;
  /** Course par */
  par: number;
  /** Total yardage */
  totalYards?: number;
  /** Course rating (difficulty rating) */
  courseRating?: number;
  /** Slope rating */
  slopeRating?: number;
  /** Whether the course is public or private */
  isPublic: boolean;
  /** Course contact phone */
  phone?: string;
  /** Course website URL */
  websiteUrl?: string;
  /** Tee time booking URL */
  bookingUrl?: string;
  /** Whether the course is active and available for play */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Legacy Handicap interface - use MemberGolfStats instead
 * @deprecated Use MemberGolfStats instead
 */
export interface Handicap {
  /** Unique identifier for the handicap record */
  id: UUID;
  /** Reference to the user */
  userId: UUID;
  /** Current handicap index */
  index: number;
  /** Last updated date */
  lastUpdated: string;
  /** Handicap system used (e.g., 'USGA', 'WHS', 'EGA') */
  system: string;
  /** Associated club/association ID */
  clubId?: string;
  /** GHIN number (if applicable) */
  ghinNumber?: string;
  /** Trend handicap (indicates direction of play) */
  trend?: number;
  /** Low handicap index (best 12-month rolling) */
  lowIndex?: number;
  /** Soft cap buffer (WHS) */
  softCap?: number;
  /** Hard cap (WHS) */
  hardCap?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Legacy Round interface - use GolfRound instead
 * @deprecated Use GolfRound instead
 */
export interface Round {
  /** Unique identifier for the round */
  id: UUID;
  /** Reference to the user who played */
  userId: UUID;
  /** Reference to the course (optional for home courses) */
  courseId?: UUID;
  /** Course name (denormalized for display) */
  courseName?: string;
  /** Date the round was played */
  playedAt: string;
  /** Total score */
  score: number;
  /** Adjusted gross score (for handicap calculation) */
  adjustedGrossScore?: number;
  /** Course handicap used for this round */
  courseHandicap?: number;
  /** Playing handicap (course handicap + any adjustments) */
  playingHandicap?: number;
  /** Hole-by-hole scores */
  holeScores?: number[];
  /** Hole-by-hole putts */
  holePutts?: number[];
  /** Hole-by-hole fairways hit */
  holeFairways?: Array<'hit' | 'left' | 'right' | 'na'>;
  /** Hole-by-hole greens in regulation */
  holeGirs?: boolean[];
  /** Weather conditions */
  weatherConditions?: 'sunny' | 'cloudy' | 'rainy' | 'windy' | 'foggy' | 'mixed';
  /** Tee played from */
  teePlayed?: string;
  /** Round type (casual, competition, etc.) */
  roundType?: 'casual' | 'competition' | 'practice' | 'tournament';
  /** Notes about the round */
  notes?: string;
  /** Whether this round counts toward handicap */
  countsTowardHandicap: boolean;
  /** Differential score calculated for handicap */
  differential?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Legacy DTOs (for backward compatibility)
// ============================================================================

/**
 * Legacy DTO for creating a new golf round
 * @deprecated Use CreateRoundInput instead
 */
export interface RoundCreateDTO {
  courseId?: UUID;
  courseName?: string;
  playedAt: string;
  score: number;
  adjustedGrossScore?: number;
  courseHandicap?: number;
  playingHandicap?: number;
  holeScores?: number[];
  holePutts?: number[];
  holeFairways?: Array<'hit' | 'left' | 'right' | 'na'>;
  holeGirs?: boolean[];
  weatherConditions?: 'sunny' | 'cloudy' | 'rainy' | 'windy' | 'foggy' | 'mixed';
  teePlayed?: string;
  roundType?: 'casual' | 'competition' | 'practice' | 'tournament';
  notes?: string;
}

/**
 * Legacy DTO for updating handicap information
 * @deprecated Use MemberGolfStats properties instead
 */
export interface HandicapUpdateDTO {
  index: number;
  system: string;
  clubId?: string;
  ghinNumber?: string;
}

/**
 * Legacy golf-specific matching preferences
 * @deprecated Use RoundFilters or other newer types
 */
export interface GolfMatchPreferencesDTO {
  /** Preferred handicap range (± from user's handicap) */
  handicapRange?: number;
  /** Preferred tee times (earliest and latest) */
  preferredTeeTimeRange?: {
    earliest: string;
    latest: string;
  };
  /** Preferred days of week (0=Sunday, 6=Saturday) */
  preferredWeekdays?: number[];
  /** Willing to travel (miles/km) */
  maxDistanceKm?: number;
  /** Preferred course difficulty (based on course rating) */
  preferredCourseDifficulty?: 'easy' | 'moderate' | 'challenging' | 'any';
  /** Walking vs riding cart preference */
  cartPreference?: 'walking' | 'riding' | 'either';
  /** Drinking/smoking preferences */
  lifestylePreferences?: string[];
  /** Competitive level preference */
  competitiveLevel?: 'casual' | 'competitive' | 'tournament' | 'any';
}

/**
 * Legacy aggregated golf statistics
 * @deprecated Use MemberGolfStats instead
 */
export interface GolfStatisticsDTO {
  userId: UUID;
  totalRounds: number;
  averageScore: number;
  bestScore: number;
  avgPar3Score?: number;
  avgPar4Score?: number;
  avgPar5Score?: number;
  fairwaysInRegulationPct?: number;
  greensInRegulationPct?: number;
  avgPuttsPerRound?: number;
  avgPuttsPerGir?: number;
  sandSavePct?: number;
  upAndDownPct?: number;
  birdiesPerRound?: number;
  parsPerRound?: number;
  bogeysPerRound?: number;
  doublesOrWorsePerRound?: number;
  mostPlayedCourse?: {
    courseId: UUID;
    courseName: string;
    roundsPlayed: number;
  };
  period: {
    from: string;
    to: string;
  };
}

/**
 * Legacy parameters for searching golf courses
 * @deprecated Use RoundFilters instead
 */
export interface CourseSearchParamsDTO {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  city?: string;
  state?: string;
  minHoles?: number;
  isPublic?: boolean;
  maxCourseRating?: number;
  minCourseRating?: number;
  query?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Legacy Utility Functions (for backward compatibility)
// ============================================================================

/**
 * Check if a round is valid (has required fields)
 * @deprecated Use validation schemas instead
 */
export function isValidRound(round: Partial<Round>): round is Round {
  return (
    typeof round.id === 'string' &&
    typeof round.userId === 'string' &&
    typeof round.score === 'number' &&
    typeof round.playedAt === 'string' &&
    typeof round.countsTowardHandicap === 'boolean'
  );
}

/**
 * Check if handicap is valid and current (not expired)
 * @deprecated Use MemberGolfStats properties instead
 */
export function isHandicapCurrent(handicap: Handicap, maxAgeDays: number = 365): boolean {
  const lastUpdated = new Date(handicap.lastUpdated);
  const maxAge = new Date();
  maxAge.setDate(maxAge.getDate() - maxAgeDays);
  return lastUpdated >= maxAge;
}

/**
 * Calculate handicap differential for a round
 * Uses the WHS formula: (113 / Slope Rating) × (Adjusted Gross Score - Course Rating)
 * @deprecated Use handicap calculation service instead
 */
export function calculateHandicapDifferential(
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number
): number {
  if (slopeRating <= 0) {
    throw new Error('Slope rating must be greater than 0');
  }
  return (113 / slopeRating) * (adjustedGrossScore - courseRating);
}

/**
 * Calculate Greens in Regulation percentage
 * @deprecated Use MemberGolfStats properties instead
 */
export function calculateGirPct(holeGirs: boolean[]): number {
  if (holeGirs.length === 0) return 0;
  const girCount = holeGirs.filter(gir => gir).length;
  return (girCount / holeGirs.length) * 100;
}

/**
 * Calculate Fairways in Regulation percentage
 * Excludes par 3s (typically holes 3, 6, 9, 12, 15, 18 on an 18-hole course)
 * @deprecated Use MemberGolfStats properties instead
 */
export function calculateFairwayPct(holeFairways: Array<'hit' | 'left' | 'right' | 'na'>): number {
  const validFairways = holeFairways.filter(f => f !== 'na');
  if (validFairways.length === 0) return 0;
  const hitCount = validFairways.filter(f => f === 'hit').length;
  return (hitCount / validFairways.length) * 100;
}
