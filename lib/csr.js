import { db, ref, get, set, update, serverTimestamp, query, orderByChild, equalTo } from "./firebase";

export function slugify(input) {
  const base = String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "csr";
}

export function makeStableSlug(base, uid) {
  const suffix = String(uid || "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toLowerCase() || Math.random().toString(36).slice(2, 8);
  return `${slugify(base)}-${suffix}`;
}

export async function isSlugAvailable(slug, ownerUid) {
  const snap = await get(ref(db, `publicCsrs/${slug}`));
  if (!snap.exists()) return true;
  const val = snap.val();
  return val?.ownerUid === ownerUid; // owner can keep their slug
}

export async function reserveUniqueSlug(desiredBase, ownerUid) {
  let slug = makeStableSlug(desiredBase, ownerUid);
  // If taken by someone else, append randomness until available (bounded)
  for (let i = 0; i < 6; i++) {
    const ok = await isSlugAvailable(slug, ownerUid);
    if (ok) return slug;
    slug = `${slugify(desiredBase)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return `${slugify(desiredBase)}-${Date.now().toString(36)}`;
}

export function defaultCsrConfig(user) {
  const company = "";
  return {
    csrName: "Abbie",
    companyName: company,
    greeting: "Hi, thanks for calling. How can I help you today?",
    persona: "Friendly, clear, and helpful customer service representative.",
    language: "English",
    voiceProvider: "livekit",
    livekitAgentName: "customer-support-1bda",
    published: true,
  };
}

export async function getUserProfile(uid) {
  const snap = await get(ref(db, `users/${uid}/profile`));
  return snap.exists() ? snap.val() : null;
}

export async function getUserCsrConfig(uid) {
  const snap = await get(ref(db, `users/${uid}/csrConfig`));
  return snap.exists() ? snap.val() : null;
}

export async function saveUserCsr(uid, profile, config) {
  const slug = config.slug || await reserveUniqueSlug(config.companyName || config.csrName || "csr", uid);
  const now = serverTimestamp();
  const safeConfig = {
    csrName: String(config.csrName || "Abbie").trim().slice(0, 80),
    companyName: String(config.companyName || "").trim().slice(0, 120),
    greeting: String(config.greeting || "").trim().slice(0, 500),
    persona: String(config.persona || "").trim().slice(0, 4000),
    language: String(config.language || "English").trim().slice(0, 40),
    voiceProvider: String(config.voiceProvider || "livekit").trim().slice(0, 40),
    livekitAgentName: String(config.livekitAgentName || "customer-support-1bda").trim().slice(0, 120),
    published: config.published !== false,
    slug,
    ownerUid: uid,
    updatedAt: now,
  };

  const safeProfile = {
    email: String(profile?.email || "").trim().slice(0, 200),
    displayName: String(profile?.displayName || "").trim().slice(0, 120),
    ownerUid: uid,
    updatedAt: now,
  };

  // Persist private owner data
  await update(ref(db, `users/${uid}`), {
    profile: { ...safeProfile, createdAt: profile?.createdAt || now },
    csrConfig: { ...safeConfig, createdAt: config?.createdAt || now },
  });

  // Publish public CSR record (slug -> config snapshot) for public URL resolution
  const publicRecord = {
    ownerUid: uid,
    slug,
    csrName: safeConfig.csrName,
    companyName: safeConfig.companyName,
    greeting: safeConfig.greeting,
    persona: safeConfig.persona,
    language: safeConfig.language,
    voiceProvider: safeConfig.voiceProvider,
    livekitAgentName: safeConfig.livekitAgentName,
    published: safeConfig.published,
    updatedAt: now,
    createdAt: config?.publicCreatedAt || now,
  };
  await set(ref(db, `publicCsrs/${slug}`), publicRecord);

  return { slug, config: safeConfig, profile: safeProfile };
}

export async function getPublicCsr(slug) {
  const clean = String(slug || "").trim();
  if (!clean) return null;
  const snap = await get(ref(db, `publicCsrs/${clean}`));
  if (!snap.exists()) return null;
  const val = snap.val();
  if (val?.published === false) return null;
  return val;
}
