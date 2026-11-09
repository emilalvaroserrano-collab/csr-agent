import { db, ref, get, set, update, serverTimestamp } from "./firebase";

export function slugify(input) {
  const base = String(input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "csr-agent";
}

function rand(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}

export function makePublicSlug(businessName, personaName) {
  // Desired format: /agent/business-name-sarah (collision resistance added if needed)
  const a = slugify(businessName);
  const b = slugify(personaName);
  return `${a}-${b}`.replace(/^-+|-+$/g, "") || `csr-agent-${rand(5)}`;
}

export async function isSlugAvailable(slug, ownerUid) {
  const snap = await get(ref(db, `publicCsrs/${slug}`));
  if (!snap.exists()) return true;
  const val = snap.val();
  return val?.ownerUid === ownerUid; // owner can keep their slug
}

export async function resolveUniqueSlug(desiredSlug, ownerUid, existingSlug) {
  if (existingSlug && await isSlugAvailable(existingSlug, ownerUid)) return existingSlug;
  let slug = slugify(desiredSlug);
  for (let i = 0; i < 8; i++) {
    if (await isSlugAvailable(slug, ownerUid)) return slug;
    slug = `${slugify(desiredSlug)}-${rand(4)}`;
  }
  return `${slugify(desiredSlug)}-${Date.now().toString(36)}`;
}

export function buildSystemPrompt(fields, existingMetadata = {}) {
  const personaName = fields.personaName || "AI CSR";
  const businessName = fields.businessName || "the business";
  const businessUrl = fields.businessUrl || "";
  const roles = fields.csrRoles || "";
  const description = fields.csrDescription || "";
  const backstory = fields.agentBackstory || "";
  const primaryGoal = fields.primaryGoal || "";
  const preservedRules = existingMetadata.systemRules || "Follow company policy, protect privacy, never expose secrets or internal system details, and be truthful when unsure.";

  return [
    `You are ${personaName}, the AI customer service representative for ${businessName}.`,
    businessUrl ? `Official website: ${businessUrl}.` : "",
    roles ? `Roles and responsibilities: ${roles}` : "",
    description ? `Personality and communication style: ${description}` : "",
    backstory ? `Professional backstory: ${backstory}` : "",
    primaryGoal ? `Primary goal for inbound customer calls: ${primaryGoal}` : "",
    `System-level rules (preserved): ${preservedRules}`,
    "Speak naturally for voice. Be clear, helpful, and accurate. Ask only necessary questions. Never invent facts, private data, or completed actions.",
  ].filter(Boolean).join("\n\n");
}

export function normalizeConfig(input = {}, existing = {}) {
  // Supports new spec fields + preserves existing metadata/compat fields
  const personaName = String(input.personaName ?? input.csrName ?? existing.personaName ?? existing.csrName ?? "Abbie").trim().slice(0, 80);
  const businessName = String(input.businessName ?? input.companyName ?? existing.businessName ?? existing.companyName ?? "").trim().slice(0, 120);
  const businessUrl = String(input.businessUrl ?? existing.businessUrl ?? "").trim().slice(0, 300);
  const csrRoles = String(input.csrRoles ?? input.rolesResponsibilities ?? existing.csrRoles ?? existing.rolesResponsibilities ?? "").trim().slice(0, 4000);
  const csrDescription = String(input.csrDescription ?? input.persona ?? existing.csrDescription ?? existing.persona ?? "").trim().slice(0, 4000);
  const agentBackstory = String(input.agentBackstory ?? input.backstory ?? existing.agentBackstory ?? existing.backstory ?? "").trim().slice(0, 4000);
  const primaryGoal = String(input.primaryGoal ?? existing.primaryGoal ?? "").trim().slice(0, 1000);

  const merged = {
    ...existing, // preserve existing metadata/provider IDs/voice/model settings
    ...input,
    // canonical fields
    personaName, csrName: personaName,
    businessName, companyName: businessName,
    businessUrl,
    csrRoles, rolesResponsibilities: csrRoles,
    csrDescription, persona: csrDescription,
    agentBackstory, backstory: agentBackstory,
    primaryGoal,
    // preserved/existing operational settings
    language: String(input.language ?? existing.language ?? "English").trim().slice(0, 40),
    voiceProvider: String(input.voiceProvider ?? existing.voiceProvider ?? "livekit").trim().slice(0, 40),
    livekitAgentName: String(input.livekitAgentName ?? existing.livekitAgentName ?? "customer-support-1bda").trim().slice(0, 120),
    published: input.published !== false && existing.published !== false,
  };
  merged.systemPrompt = buildSystemPrompt(merged, existing.metadata || existing);
  return merged;
}

export async function getUserBundle(uid) {
  const snap = await get(ref(db, `users/${uid}`));
  if (!snap.exists()) return null;
  const v = snap.val() || {};
  // backward compat with previous shape
  const profile = v.profile || null;
  const businessProfile = v.businessProfile || (v.csrConfig ? { businessName: v.csrConfig.businessName || v.csrConfig.companyName, businessUrl: v.csrConfig.businessUrl } : null);
  const csrAgent = v.csrAgent || (v.csrConfig?.agentId ? { agentId: v.csrConfig.agentId } : null);
  const agentConfig = normalizeConfig(v.agentConfig || v.csrConfig || {}, v.agentConfig || v.csrConfig || {});
  return { profile, businessProfile, csrAgent, agentConfig, raw: v };
}

export async function getUserProfile(uid) {
  const b = await getUserBundle(uid);
  return b?.profile || null;
}

export async function getUserCsrConfig(uid) {
  const b = await getUserBundle(uid);
  return b?.agentConfig || null;
}

export async function saveUserCsr(uid, profileInput, configInput) {
  const existing = await getUserBundle(uid);
  const existingConfig = existing?.agentConfig || {};
  const config = normalizeConfig(configInput, existingConfig);

  const agentId = existingConfig.agentId || config.agentId || `agent_${uid.slice(0, 8)}_${Date.now().toString(36)}`;
  const desiredSlug = config.slug && existingConfig.slug === config.slug
    ? config.slug
    : makePublicSlug(config.businessName || config.companyName, config.personaName || config.csrName);
  const slug = await resolveUniqueSlug(desiredSlug, uid, existingConfig.slug);
  const deploymentStatus = config.voiceProvider === "livekit" ? "configured" : "pending_provider";

  const now = serverTimestamp();
  const profile = {
    ...(existing?.profile || {}),
    email: String(profileInput?.email || existing?.profile?.email || "").trim().slice(0, 200),
    displayName: String(profileInput?.displayName || existing?.profile?.displayName || "").trim().slice(0, 120),
    ownerUid: uid,
    updatedAt: now,
    createdAt: existing?.profile?.createdAt || now,
    onboardingComplete: true,
  };

  const businessProfile = {
    ownerUid: uid,
    businessName: config.businessName,
    businessUrl: config.businessUrl,
    updatedAt: now,
    createdAt: existing?.businessProfile?.createdAt || now,
  };

  const csrAgent = {
    ownerUid: uid,
    agentId,
    slug,
    publicPath: `/agent/${slug}`,
    deploymentStatus,
    updatedAt: now,
    createdAt: existing?.csrAgent?.createdAt || now,
  };

  const agentConfig = {
    ...config,
    ownerUid: uid,
    agentId,
    slug,
    publicPath: `/agent/${slug}`,
    deploymentStatus,
    updatedAt: now,
    createdAt: existingConfig.createdAt || now,
  };

  // Maintain relationship: User UID → Business Profile → CSR Agent → Agent Configuration → Public Slug
  await update(ref(db, `users/${uid}`), {
    profile,
    businessProfile,
    csrAgent,
    agentConfig,
    // legacy compatibility
    csrConfig: agentConfig,
  });

  const publicRecord = {
    ownerUid: uid,
    agentId,
    slug,
    publicPath: `/agent/${slug}`,
    personaName: agentConfig.personaName,
    csrName: agentConfig.personaName,
    businessName: agentConfig.businessName,
    companyName: agentConfig.businessName,
    businessUrl: agentConfig.businessUrl,
    csrRoles: agentConfig.csrRoles,
    csrDescription: agentConfig.csrDescription,
    agentBackstory: agentConfig.agentBackstory,
    primaryGoal: agentConfig.primaryGoal,
    greeting: agentConfig.greeting || `Hi, this is ${agentConfig.personaName} from ${agentConfig.businessName || "our team"}. How can I help?`,
    systemPrompt: agentConfig.systemPrompt,
    language: agentConfig.language,
    voiceProvider: agentConfig.voiceProvider,
    livekitAgentName: agentConfig.livekitAgentName,
    deploymentStatus,
    published: agentConfig.published,
    updatedAt: now,
    createdAt: existingConfig.publicCreatedAt || now,
  };
  await set(ref(db, `publicCsrs/${slug}`), publicRecord);
  // Clean up old slug record only if it belonged to this owner and changed
  if (existingConfig.slug && existingConfig.slug !== slug) {
    try {
      const old = await get(ref(db, `publicCsrs/${existingConfig.slug}`));
      if (old.exists() && old.val()?.ownerUid === uid) await set(ref(db, `publicCsrs/${existingConfig.slug}`), null);
    } catch {}
  }

  return { slug, agentId, config: agentConfig, profile, businessProfile, csrAgent };
}

export async function getPublicCsr(slug) {
  const clean = slugify(String(slug || "").trim()) || String(slug || "").trim();
  if (!clean) return null;
  // try exact first (preserve legacy slugs), then slugified
  let snap = await get(ref(db, `publicCsrs/${String(slug || "").trim()}`));
  if (!snap.exists()) snap = await get(ref(db, `publicCsrs/${clean}`));
  if (!snap.exists()) return null;
  const val = snap.val();
  if (val?.published === false) return null;
  return val;
}

export function publicAgentUrl(origin, slug) {
  return `${origin || ""}/agent/${slug}`;
}

export function embedSnippet(origin, slug) {
  const url = publicAgentUrl(origin, slug);
  return `<iframe src="${url}" title="AI Customer Service Agent" style="width:100%;max-width:420px;height:720px;border:0;border-radius:16px;overflow:hidden;" allow="microphone; autoplay"></iframe>`;
}
