"""Reproducible, independently timed wing imitation; no lift/root motion.

Each wing draws its own cycle durations, stroke ratios and amplitudes.
Quintic interpolation gives zero velocity/acceleration at reversals. The
finite GLB performance loops after 16.8 seconds; it is not runtime entropy.
"""
import random

DURATION = 16.8

def smooth(t):
    t = max(0., min(1., t))
    return t*t*t*(10+t*(-15+6*t))

def make_schedule(seed, count):
    rng = random.Random(seed)
    lengths = [rng.uniform(1.45, 3.8) for _ in range(count)]
    scale = DURATION / sum(lengths)
    result = []
    start = 0.
    for length in lengths:
        duration = length*scale
        result.append((start, duration, rng.uniform(.27, .66), rng.uniform(.20, .36)))
        start += duration
    return result

SCHEDULES = {'.L': make_schedule(250925, 7), '.R': make_schedule(250926, 5)}

def stroke(side, time):
    time %= DURATION
    for start, duration, ratio, amplitude in SCHEDULES[side]:
        if time <= start+duration+1e-9:
            u = (time-start)/duration
            down = smooth(u/ratio) if u <= ratio else 1-smooth((u-ratio)/(1-ratio))
            return .32 - 2*amplitude*down
    return .32

def flap(side, time, clip_duration, looping=False):
    if looping:
        return stroke(side, time)
    # Non-looping transitions return to a shared pose, with a gentle envelope.
    envelope = smooth(time/.6)*smooth((clip_duration-time)/.6)
    return .32+(stroke(side,time)-.32)*envelope
