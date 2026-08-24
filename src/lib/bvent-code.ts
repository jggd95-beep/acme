/** Back-compat — sheets live in field-code.ts */
import { FIELD_CODE } from "./field-code";

export {
  isBventQuestion,
  FIELD_CODE as _FIELD_CODE,
} from "./field-code";

export const BVENT_CODE_TITLE = FIELD_CODE.bvent.title;
export const BVENT_CODE_BLURB = FIELD_CODE.bvent.blurb;
export const BVENT_CODE_POINTS = FIELD_CODE.bvent.points;