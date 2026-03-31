const PLACEHOLDERS = ["{{datetime}}", "{{gitUser}}"] as const;

export class CommitMessageTemplateError extends Error {
  readonly details: string[];

  constructor(details: string[]) {
    super(details.join(" "));
    this.name = "CommitMessageTemplateError";
    this.details = details;
  }
}

export function validateCommitMessageTemplate(template: string): string[] {
  const trimmed = template.trim();
  const errors: string[] = [];

  if (!trimmed) {
    errors.push("Commit message template cannot be empty.");
  }

  const unknownPlaceholders = trimmed.match(/{{[^}]+}}/g) ?? [];
  for (const placeholder of unknownPlaceholders) {
    if (!PLACEHOLDERS.includes(placeholder as (typeof PLACEHOLDERS)[number])) {
      errors.push(
        `Unsupported commit message placeholder "${placeholder}". Supported placeholders are ${PLACEHOLDERS.join(", ")}.`,
      );
    }
  }

  return errors;
}

export function formatLocalDateTime(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = `${Math.floor(absoluteOffset / 60)}`.padStart(2, "0");
  const offsetRemainder = `${absoluteOffset % 60}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetRemainder}`;
}

export function renderCommitMessage(
  template: string,
  gitUser: string,
  date = new Date(),
): string {
  const errors = validateCommitMessageTemplate(template);
  if (errors.length > 0) {
    throw new CommitMessageTemplateError(errors);
  }

  return template
    .replace(/{{datetime}}/g, formatLocalDateTime(date))
    .replace(/{{gitUser}}/g, gitUser);
}
