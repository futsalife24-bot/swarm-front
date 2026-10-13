/** The first half of a wind-up is a readable body pose; the second half warns in red. */
export function redWarningDuringWind(remaining: number, wind: number) {
  return wind > 0 && remaining > 0 && remaining <= wind * 0.5;
}

export function redWarningAfterStart(age: number, wind: number) {
  return wind > 0 && age >= wind * 0.5 && age < wind;
}

/** Reserved missiles are visible only after their launcher has had time to prepare. */
export function redWarningBeforeLaunch(
  time: number,
  launch: number,
  wind: number,
) {
  return time >= launch - wind * 0.5;
}
