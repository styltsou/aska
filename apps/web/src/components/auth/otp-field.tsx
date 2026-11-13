import { Fragment } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import {
  InputOTP,
  InputOTPFocusRing,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const OTP_LENGTH = 6;

/** Six-digit code entry shared by the verify-email and reset-password pages.
 * `autoComplete="one-time-code"` lets phones offer the code from the email or
 * SMS notification. */
export function OtpField({
  id,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <InputOTP
      aria-label="Verification code"
      autoComplete="one-time-code"
      // Deliberate: the code screens exist only to enter this code.
      // oxlint-disable-next-line jsx-a11y/no-autofocus
      autoFocus={autoFocus}
      containerClassName="relative w-full justify-between"
      disabled={disabled}
      id={id}
      maxLength={OTP_LENGTH}
      onChange={onChange}
      onComplete={onComplete}
      pattern={REGEXP_ONLY_DIGITS}
      value={value}
    >
      <InputOTPFocusRing invalid={invalid} />
      {[0, 1].map((group) => (
        <Fragment key={group}>
          {group > 0 ? <InputOTPSeparator className="px-2" /> : null}
          <InputOTPGroup className="flex-1">
            {[0, 1, 2].map((offset) => {
              const index = group * 3 + offset;
              return (
                <InputOTPSlot
                  aria-invalid={invalid || undefined}
                  className="h-11 flex-1 text-base"
                  index={index}
                  key={index}
                />
              );
            })}
          </InputOTPGroup>
        </Fragment>
      ))}
    </InputOTP>
  );
}
