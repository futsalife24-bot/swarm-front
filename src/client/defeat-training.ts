import {
  OPERATION_KEYS,
  defaultStore,
  hasOperationFlag,
} from "./tutorial-flags";

/** C-6 F10: show the training sub-button only after a loss with unfinished operations. */
export function shouldOfferDefeatTraining(
  win: boolean,
  developerMode: boolean,
  store = defaultStore(),
) {
  if (win || developerMode) return false;
  return OPERATION_KEYS.some((key) => !hasOperationFlag(`op:${key}`, store));
}
