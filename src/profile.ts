import { readFile } from "node:fs/promises";
import { z } from "zod";

const profileSchema = z.object({
  contact: z
    .object({
      email: z.string().optional(),
      phone: z.string().optional(),
      linkedin: z.string().optional(),
      github: z.string().optional(),
      website: z.string().optional()
    })
    .default({}),
  textAnswers: z.record(z.string(), z.string()).default({}),
  selectAnswers: z.record(z.string(), z.string()).default({})
});

export type ApplicationProfile = z.infer<typeof profileSchema>;

export async function loadProfile(profilePath: string): Promise<ApplicationProfile> {
  const raw = await readFile(profilePath, "utf8");
  const parsed = profileSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    console.error("Invalid application-profile.json");
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}
