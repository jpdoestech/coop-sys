import { z } from "zod";
import { MOBILE_NUMBER_PATTERN } from "../../utils/inputSanitizers";

export const mobileNumberSchema = z.string().trim().regex(MOBILE_NUMBER_PATTERN, "Mobile number must contain exactly 11 digits and start with 09.").nullable().optional().or(z.literal(""));
