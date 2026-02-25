import { db } from "@/lib/db";
import { profileUpsertSchema, type ProfileRole, type ProfileUpsertInput } from "@/lib/domain/profile-schema";

interface ProfileRow {
  id: string;
  role: ProfileRole;
  timeBudgetMinutes: number | null;
  hypeWords: string | null;
}

interface ProfileWrite {
  role: ProfileRole;
  timeBudgetMinutes: number | null;
  hypeWords: string | null;
}

interface ProfileRouteDeps {
  findProfile: () => Promise<ProfileRow | null>;
  createProfile: (data: ProfileWrite) => Promise<ProfileRow>;
  updateProfile: (id: string, data: ProfileWrite) => Promise<ProfileRow>;
}

const profileSelect = {
  id: true,
  role: true,
  timeBudgetMinutes: true,
  hypeWords: true
} as const;

function parseHypeWords(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }
}

function toProfileResponse(profile: ProfileRow | null): {
  role: ProfileRole;
  timeBudgetMinutes: number | null;
  hypeWords: string[];
} {
  if (!profile) {
    return {
      role: "ENG",
      timeBudgetMinutes: null,
      hypeWords: []
    };
  }

  return {
    role: profile.role,
    timeBudgetMinutes: profile.timeBudgetMinutes,
    hypeWords: parseHypeWords(profile.hypeWords)
  };
}

function toProfileWrite(input: ProfileUpsertInput): ProfileWrite {
  return {
    role: input.role,
    timeBudgetMinutes: input.timeBudgetMinutes ?? null,
    hypeWords: input.hypeWords && input.hypeWords.length > 0 ? JSON.stringify(input.hypeWords) : null
  };
}

const defaultDeps: ProfileRouteDeps = {
  findProfile: () =>
    db.userProfile.findFirst({
      orderBy: { createdAt: "asc" },
      select: profileSelect
    }) as Promise<ProfileRow | null>,
  createProfile: (data) =>
    db.userProfile.create({
      data,
      select: profileSelect
    }) as Promise<ProfileRow>,
  updateProfile: (id, data) =>
    db.userProfile.update({
      where: { id },
      data,
      select: profileSelect
    }) as Promise<ProfileRow>
};

export function createProfileGetHandler(deps: ProfileRouteDeps = defaultDeps) {
  return async function GET(): Promise<Response> {
    const profile = await deps.findProfile();
    return Response.json(toProfileResponse(profile));
  };
}

export function createProfilePostHandler(deps: ProfileRouteDeps = defaultDeps) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const parsed = profileUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "INVALID_PROFILE_PAYLOAD" }, { status: 400 });
    }

    const data = toProfileWrite(parsed.data);
    const existing = await deps.findProfile();
    const saved = existing
      ? await deps.updateProfile(existing.id, data)
      : await deps.createProfile(data);

    return Response.json(toProfileResponse(saved));
  };
}

export const GET = createProfileGetHandler();
export const POST = createProfilePostHandler();
