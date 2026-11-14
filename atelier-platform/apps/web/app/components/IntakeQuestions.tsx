"use client";
import { CustomSelect } from "./CustomSelect";
import { DateTimePicker } from "./DateTimePicker";
export type IntakeQuestion = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
};
export function IntakeQuestions({
  questions,
  answers,
  onChange,
}: {
  questions: IntakeQuestion[];
  answers: Record<string, string | boolean>;
  onChange: (key: string, value: string | boolean) => void;
}) {
  return (
    <div className="intake-questions">
      {questions.map((field, index) => {
        const bool = ["checkbox", "consent"].includes(field.type);
        return (
          <label
            className={bool ? "checkbox intake-consent" : "intake-question"}
            key={field.key}
          >
            {!bool && (
              <span>
                <small>{index + 1}.</small> {field.label}
                {field.required && <span className="required-mark"> *</span>}
              </span>
            )}
            {bool ? (
              <>
                <input
                  type="checkbox"
                  checked={answers[field.key] === true}
                  required={field.required}
                  onChange={(event) =>
                    onChange(field.key, event.target.checked)
                  }
                />
                <span>
                  {field.label}
                  {field.required ? " *" : ""}
                </span>
              </>
            ) : field.type === "textarea" ? (
              <textarea
                rows={4}
                maxLength={5000}
                required={field.required}
                value={String(answers[field.key] || "")}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            ) : field.type === "select" ? (
              <CustomSelect
                aria-label={field.label}
                required={field.required}
                value={String(answers[field.key] || "")}
                onChange={(event) => onChange(field.key, event.target.value)}
              >
                <option value="">Choose an option</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </CustomSelect>
            ) : field.type === "date" ? (
              <DateTimePicker
                type="date"
                aria-label={field.label}
                required={field.required}
                value={String(answers[field.key] || "")}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            ) : (
              <input
                type={
                  field.type === "phone"
                    ? "tel"
                    : ["email", "number"].includes(field.type)
                      ? field.type
                      : "text"
                }
                step={field.type === "number" ? "any" : undefined}
                maxLength={5000}
                required={field.required}
                value={String(answers[field.key] || "")}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
