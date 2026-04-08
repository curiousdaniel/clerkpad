/**
 * HubSpot CRM sync after ClerkBid signup. For valid internal property names when
 * extending mappings, see exports in /hs-fields/ (contact.csv, company.csv).
 */

import { HubSpotRequestError, hubspotRequest } from "@/lib/hubspot/client";
import {
  extractEmailDomain,
  isConsumerEmailDomain,
} from "@/lib/hubspot/emailDomain";

export type HubSpotRegistrationPayload = {
  email: string;
  firstName: string;
  lastName: string;
  organizationName: string;
};

type SearchResult = {
  total: number;
  results: Array<{ id: string }>;
};

type CreateResult = { id: string };

const CONTACT_SIGNUP_PROP = "HUBSPOT_CONTACT_SIGNUP_SOURCE_PROP";
const CONTACT_SIGNUP_VALUE = "HUBSPOT_CONTACT_SIGNUP_SOURCE_VALUE";
const COMPANY_SIGNUP_PROP = "HUBSPOT_COMPANY_SIGNUP_SOURCE_PROP";
const COMPANY_SIGNUP_VALUE = "HUBSPOT_COMPANY_SIGNUP_SOURCE_VALUE";

/** Marketing contact status: HubSpot enum “Marketing contact (true)” */
const MARKETING_CONTACT_STATUS_PROP = "hs_marketable_status";
const MARKETING_CONTACT_STATUS_VALUE = "true";

const OWNER_PROP = "hubspot_owner_id";

let cachedOwnerId: string | undefined;
let ownerResolveLoggedError = false;

function envTrim(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function contactAttributionProps(): Record<string, string> {
  const prop = envTrim(CONTACT_SIGNUP_PROP);
  if (!prop) return {};
  const val = envTrim(CONTACT_SIGNUP_VALUE) ?? "ClerkBid";
  return { [prop]: val };
}

function companyAttributionProps(): Record<string, string> {
  const prop = envTrim(COMPANY_SIGNUP_PROP);
  if (!prop) return {};
  const val = envTrim(COMPANY_SIGNUP_VALUE) ?? "ClerkBid";
  return { [prop]: val };
}

/**
 * Resolves hubspot_owner_id: explicit env, else CRM Owners API by email.
 * Requires owner read scope on the Private App if not using HUBSPOT_CONTACT_OWNER_ID.
 */
async function resolveHubSpotOwnerId(token: string): Promise<string | undefined> {
  const explicit = envTrim("HUBSPOT_CONTACT_OWNER_ID");
  if (explicit) {
    cachedOwnerId = explicit;
    return explicit;
  }
  if (cachedOwnerId) return cachedOwnerId;

  const email =
    envTrim("HUBSPOT_CONTACT_OWNER_EMAIL") ?? "daniel@auctionmethod.com";

  try {
    const res = await hubspotRequest<{ results?: Array<{ id: string }> }>(
      token,
      `/crm/v3/owners?email=${encodeURIComponent(email)}&limit=1`
    );
    const id = res.results?.[0]?.id;
    if (id) {
      cachedOwnerId = String(id);
      return cachedOwnerId;
    }
  } catch (e) {
    if (!ownerResolveLoggedError) {
      ownerResolveLoggedError = true;
      console.error(
        "[hubspot] could not resolve contact owner by email; set HUBSPOT_CONTACT_OWNER_ID or grant crm.objects.owners.read",
        e
      );
    }
  }
  return undefined;
}

/** Extra HubSpot contact fields applied on create/patch (not lifecyclestage or lead source). */
async function contactCrmFieldProps(
  token: string
): Promise<Record<string, string>> {
  const props: Record<string, string> = {
    [MARKETING_CONTACT_STATUS_PROP]: MARKETING_CONTACT_STATUS_VALUE,
  };
  const ownerId = await resolveHubSpotOwnerId(token);
  if (ownerId) props[OWNER_PROP] = ownerId;
  return props;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function searchContactsByEmail(
  token: string,
  email: string
): Promise<SearchResult> {
  return hubspotRequest<SearchResult>(token, "/crm/v3/objects/contacts/search", {
    method: "POST",
    body: {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: "EQ",
              value: email,
            },
          ],
        },
      ],
      properties: ["email", "firstname", "lastname", "company"],
      limit: 2,
    },
  });
}

async function searchCompaniesByDomain(
  token: string,
  domain: string
): Promise<SearchResult> {
  return hubspotRequest<SearchResult>(token, "/crm/v3/objects/companies/search", {
    method: "POST",
    body: {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "domain",
              operator: "EQ",
              value: domain,
            },
          ],
        },
      ],
      properties: ["name", "domain"],
      limit: 10,
    },
  });
}

async function searchCompaniesByName(
  token: string,
  name: string
): Promise<SearchResult> {
  return hubspotRequest<SearchResult>(token, "/crm/v3/objects/companies/search", {
    method: "POST",
    body: {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "name",
              operator: "EQ",
              value: name,
            },
          ],
        },
      ],
      properties: ["name", "domain"],
      limit: 10,
    },
  });
}

async function createCompany(
  token: string,
  properties: Record<string, string>
): Promise<string> {
  const merged = { ...properties, ...companyAttributionProps() };
  const { id } = await hubspotRequest<CreateResult>(
    token,
    "/crm/v3/objects/companies",
    {
      method: "POST",
      body: { properties: merged },
    }
  );
  return id;
}

/**
 * If several companies share the same name, creating a new record avoids
 * linking the contact to the wrong organization (merge in HubSpot if needed).
 */
async function findOrCreateCompany(
  token: string,
  organizationName: string,
  email: string
): Promise<string> {
  const domain = extractEmailDomain(email);
  const useDomain = Boolean(domain && !isConsumerEmailDomain(domain));

  if (useDomain && domain) {
    const byDomain = await searchCompaniesByDomain(token, domain);
    if (byDomain.total === 1 && byDomain.results[0]) {
      return byDomain.results[0].id;
    }
    if (byDomain.total === 0) {
      return createCompany(token, { name: organizationName, domain });
    }
  }

  const byName = await searchCompaniesByName(token, organizationName);
  if (byName.total === 1 && byName.results[0]) {
    return byName.results[0].id;
  }
  if (byName.total === 0) {
    if (useDomain && domain) {
      return createCompany(token, { name: organizationName, domain });
    }
    return createCompany(token, { name: organizationName });
  }

  if (useDomain && domain) {
    return createCompany(token, { name: organizationName, domain });
  }
  return createCompany(token, { name: organizationName });
}

async function createContact(
  token: string,
  properties: Record<string, string>,
  crmProps: Record<string, string>
): Promise<string> {
  const merged = {
    ...properties,
    ...crmProps,
    ...contactAttributionProps(),
  };
  const { id } = await hubspotRequest<CreateResult>(
    token,
    "/crm/v3/objects/contacts",
    {
      method: "POST",
      body: { properties: merged },
    }
  );
  return id;
}

async function patchContact(
  token: string,
  id: string,
  properties: Record<string, string>,
  crmProps: Record<string, string>
): Promise<void> {
  const merged = {
    ...properties,
    ...crmProps,
    ...contactAttributionProps(),
  };
  if (Object.keys(merged).length === 0) return;
  await hubspotRequest(token, `/crm/v3/objects/contacts/${id}`, {
    method: "PATCH",
    body: { properties: merged },
  });
}

async function findOrCreateContact(
  token: string,
  payload: HubSpotRegistrationPayload,
  crmProps: Record<string, string>
): Promise<string> {
  const { email, firstName, lastName, organizationName } = payload;
  const found = await searchContactsByEmail(token, email);
  if (found.total >= 1 && found.results[0]) {
    const id = found.results[0].id;
    await patchContact(token, id, {
      firstname: firstName,
      lastname: lastName,
      company: organizationName,
    }, crmProps);
    return id;
  }
  return createContact(
    token,
    {
      email,
      firstname: firstName,
      lastname: lastName,
      company: organizationName,
    },
    crmProps
  );
}

/** Primary company: HubSpot-defined type id 1 (contact → company). */
function hubspotErrText(body: unknown): string {
  if (body && typeof body === "object" && "message" in body) {
    return String((body as { message?: string }).message ?? "");
  }
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

async function associateContactToPrimaryCompany(
  token: string,
  contactId: string,
  companyId: string
): Promise<void> {
  try {
    await hubspotRequest(
      token,
      "/crm/v4/associations/contact/company/batch/create",
      {
        method: "POST",
        body: {
          inputs: [
            {
              from: { id: String(contactId) },
              to: { id: String(companyId) },
              types: [
                {
                  associationCategory: "HUBSPOT_DEFINED",
                  associationTypeId: 1,
                },
              ],
            },
          ],
        },
      }
    );
  } catch (e: unknown) {
    if (e instanceof HubSpotRequestError) {
      if (e.status === 409) return;
      const t = `${e.message} ${hubspotErrText(e.body)}`;
      if (
        /already exists|already associated|duplicate|conflict|cannot create/i.test(
          t
        )
      ) {
        return;
      }
    }
    throw e;
  }
}

async function createAttributionNote(
  token: string,
  contactId: string,
  companyId: string,
  payload: HubSpotRegistrationPayload
): Promise<void> {
  const { email, organizationName } = payload;
  const safeOrg = escapeHtml(organizationName);
  const safeEmail = escapeHtml(email);
  const body = `<p>Registered for <strong>ClerkBid</strong> — ${safeOrg} (${safeEmail}).</p>`;
  await hubspotRequest<CreateResult>(token, "/crm/v3/objects/notes", {
    method: "POST",
    body: {
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: body,
      },
      associations: [
        {
          to: { id: contactId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 202,
            },
          ],
        },
        {
          to: { id: companyId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 190,
            },
          ],
        },
      ],
    },
  });
}

/**
 * Syncs registration to HubSpot when HUBSPOT_ACCESS_TOKEN is set. Never throws;
 * logs errors with a `[hubspot]` prefix. Does not block callers that void it.
 */
export async function syncHubSpotRegistration(
  payload: HubSpotRegistrationPayload
): Promise<void> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN?.trim();
  if (!token) return;

  try {
    const contactCrmProps = await contactCrmFieldProps(token);
    const companyId = await findOrCreateCompany(
      token,
      payload.organizationName,
      payload.email
    );
    const contactId = await findOrCreateContact(
      token,
      payload,
      contactCrmProps
    );
    await associateContactToPrimaryCompany(token, contactId, companyId);
    try {
      await createAttributionNote(token, contactId, companyId, payload);
    } catch (noteErr) {
      console.error("[hubspot] attribution note failed", noteErr);
    }
  } catch (e) {
    console.error("[hubspot] registration sync failed", e);
  }
}
