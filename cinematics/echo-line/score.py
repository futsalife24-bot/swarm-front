"""「残響線」の40秒のステレオ原曲。音源素材を使わず波形から生成する。"""
import argparse
import wave
from pathlib import Path
import numpy as np

RATE, SECONDS, BEAT = 48000, 40, .625
TAU = 2 * np.pi
rng = np.random.default_rng(731)
mix = np.zeros((RATE * SECONDS, 2), dtype=np.float64)
space = np.zeros_like(mix)


def add(start, signal, pan=0., send=.18):
    i = round(start * RATE)
    stop = min(i + len(signal), len(mix))
    if stop <= i:
        return
    stereo = signal[:stop-i, None] * [np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)]
    mix[i:stop] += stereo
    space[i:stop] += stereo * send


def time(length):
    return np.arange(round(length * RATE)) / RATE


def hz(note):
    return 440 * 2 ** ((note - 69) / 12)


def ring(start, note, strength, pan, length=2.4):
    t = time(length)
    f = hz(note)
    v = np.zeros_like(t)
    for mul, gain, decay in [(1, 1, 1.7), (2.006, .33, 2.7), (2.984, .24, 4.8), (4.19, .12, 7), (7.02, .055, 12)]:
        v += gain * np.sin(TAU*f*mul*t + .34*np.sin(TAU*f*1.504*t)*np.exp(-t*11)) * np.exp(-t*decay)
    add(start, .19*strength*v*np.minimum(1, t/.006)*np.minimum(1,(length-t)/.16), pan, .48)


def bowed(start, note, length, strength, pan, brass=False):
    t = time(length)
    f = hz(note)
    phase = TAU*f*t+.14*np.sin(TAU*4.6*t+pan)
    env = np.minimum(1,t/(.33 if brass else .55))**1.25 * np.minimum(1,(length-t)/.48)
    v = np.zeros_like(t)
    for h in range(1, 10 if brass else 7):
        v += np.sin(h*phase + .3*h) * (1+.11*np.sin(t*(1.7+h*.04))) * (1/h**(1.22 if brass else 1.6))
    add(start, v*env*strength, pan, .30)


def kick(start, strength):
    t = time(.58)
    v = np.sin(TAU*(43*t+5.7*(1-np.exp(-t*19))))*np.exp(-7.2*t)
    add(start, strength*(v+.18*rng.normal(size=len(t))*np.exp(-t*160))*np.minimum(1,t/.003),0,.05)


def tick(start, gain, pan, snare=False):
    t = time(.35 if snare else .12)
    noise = rng.normal(size=len(t))
    hiss = np.diff(noise, prepend=noise[0])*.5
    drum = np.sin(TAU*(147*t+1.4*(1-np.exp(-28*t))))*np.exp(-t*18)
    v = ((.68*noise*np.exp(-t*17)+.78*drum) if snare else hiss*np.exp(-t*65))
    add(start, gain*v*np.minimum(1,t/.003),pan,.28)


def swell(start, length, level):
    t=time(length)
    noise=rng.normal(size=len(t))
    low=np.convolve(noise,np.ones(28)/28,mode='same')
    env=np.sin(np.pi*t/length)**1.9
    add(start,low*env*level,-.45,.6)
    add(start+.073,low*env*level*.83,.6,.56)


# The call D–A–E first comes from solitary tuned metal, then returns in strings.
chords=[(38,57,62,64),(34,53,57,62),(41,57,60,65),(36,55,62,64)]
for bar in range(16):
    start = 2.5*bar
    bass,a,b,c = chords[(bar//2)%4]
    arc = min(1, .25+bar*.09)
    if bar>=14: arc*=.46 if bar==14 else .24
    for note, pan in [(a,-.69),(b,.56),(c,.16)]:
        bowed(start,note,2.92,.046*arc,pan)
    bowed(start,bass-12,2.83,.13*arc,0)
    if 4<=bar<=13:
        for j in range(8):
            tick(start+j*BEAT/2+(j%2)*.012,.021*(1.25 if j%2 else .7),(-1)**j*.52)
        for j in ([0,2,3.5] if 8<=bar<13 else [0,2.5]):
            kick(start+j*BEAT,.41 if 8<=bar<13 else .28)
        for j in [1,3]:
            tick(start+BEAT*j,.115 if bar>=8 else .07,.11,True)
    if 6<=bar<14:
        for j,n in enumerate([a+12,b,c+12,b+12]):
            ring(start+BEAT*j+.006*(j%2),n,.32*arc,(-1)**j*.52,.95)
for s in [1.25,5.,10.,15.,20.,27.5,35.]:
    for delta, note, pan in [(0,74,-.32),(.625,81,.28),(1.5625,76,.04)]:
        ring(s+delta,note,.85 if s<15 or s>=35 else .62,pan)
for start,n,d in [(15,62,1.6),(16.875,69,1.1),(18.125,64,1.75),(20,74,2.15),(22.5,72,1.1),(23.75,69,1.12),(25,65,2.1),(27.5,67,1.05),(28.75,69,1.22),(30,76,2.1),(32.5,74,2.05)]:
    bowed(start,n,d,.118,.05,True)
    bowed(start+.038,n-12,d,.065,-.23,True)
for s,d,l in [(0,5,.24),(7.9,2.1,.50),(12.5,2.5,.58),(17.5,2.5,.78),(22.5,2.5,.44),(27.5,1.25,.48),(30,4.7,.51),(36.2,3.8,.24)]:
    swell(s,d,l)
for s in [10,15,20,25,30,35]:
    kick(s,.43)
    ring(s,38,.54,-.18,2.7)
# Decorrelated early reflections with a longer dark tail.
for lag, gain in [(.071,.33),(.127,.27),(.211,.25),(.317,.21),(.499,.16),(.739,.12),(1.09,.09),(1.49,.06),(1.88,.035)]:
    n=round(lag*RATE)
    mix[n:]+=space[:-n,::-1]*gain
t=time(SECONDS)
mix *= (np.minimum(1,t/.11)*np.minimum(1,(SECONDS-t)/1.04))[:,None]
mix=np.tanh(mix*1.65)
mix*=.88/np.max(np.abs(mix))
if __name__ == '__main__':
    args=argparse.ArgumentParser()
    args.add_argument('output',type=Path)
    target=args.parse_args().output
    target.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(target),'wb') as stream:
        stream.setparams((2,2,RATE,0,'NONE','not compressed'))
        stream.writeframes((mix*32767).astype('<i2').tobytes())
