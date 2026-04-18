// 28 ink-drawn era icons from Claude Design P2-3. 80x80 viewBox.
import React from "react";

type IconProps = { color?: string; size?: number; opacity?: number };

const V: React.FC<React.PropsWithChildren<IconProps>> = ({ children, color = "#1a1510", size = 80, opacity = 1 }) => (
  <svg
    viewBox="0 0 80 80"
    width={size}
    height={size}
    fill="none"
    stroke={color}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ opacity }}
  >
    <g style={{ fill: "none" }}>{children}</g>
    <style>{`
      svg .thin { stroke-width: 1.1; opacity: 0.7; }
      svg .fill { fill: ${color}; stroke: none; }
    `}</style>
  </svg>
);

/* ───────── I · Childhood ───────── */

const RockingHorse: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* body */}
    <path d="M 18 44 C 22 36, 34 32, 44 34 C 52 35, 58 40, 60 46 L 58 52 L 22 52 Z" />
    {/* head */}
    <path d="M 58 44 C 62 38, 62 30, 56 28 C 52 27, 50 30, 52 36" />
    {/* mane */}
    <path className="thin" d="M 52 30 q 3 -3 5 -1 M 48 32 q 3 -3 4 -1 M 44 34 q 2 -3 4 -2" />
    {/* eye */}
    <circle className="fill" cx="57" cy="34" r="0.9" />
    {/* legs */}
    <path d="M 28 52 L 28 62" />
    <path d="M 50 52 L 50 62" />
    {/* rockers (curved base) */}
    <path d="M 14 64 C 24 72, 56 72, 66 64" />
    {/* tail */}
    <path d="M 22 44 C 14 40, 12 48, 16 54" />
  </V>
);

const BirthdayCake: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* plate */}
    <path d="M 14 62 L 66 62" />
    {/* cake body */}
    <path d="M 20 62 L 20 48 L 60 48 L 60 62" />
    {/* frosting wavy top */}
    <path d="M 20 48 q 5 -6 10 0 t 10 0 t 10 0 t 10 0" />
    {/* three candles */}
    <path d="M 28 36 L 28 44" />
    <path d="M 40 32 L 40 44" />
    <path d="M 52 36 L 52 44" />
    {/* flames */}
    <path d="M 28 36 q -2 -3 0 -6 q 2 3 0 6 Z" />
    <path d="M 40 32 q -2 -3 0 -6 q 2 3 0 6 Z" />
    <path d="M 52 36 q -2 -3 0 -6 q 2 3 0 6 Z" />
    {/* decorative dots on cake */}
    <circle className="fill" cx="30" cy="55" r="0.9" />
    <circle className="fill" cx="40" cy="58" r="0.9" />
    <circle className="fill" cx="50" cy="55" r="0.9" />
  </V>
);

const SchoolBackpack: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* main body — rounded rectangle */}
    <path d="M 22 28 C 22 22, 26 20, 30 20 L 50 20 C 54 20, 58 22, 58 28 L 58 62 C 58 66, 54 68, 50 68 L 30 68 C 26 68, 22 66, 22 62 Z" />
    {/* top flap */}
    <path d="M 26 20 L 26 38 L 54 38 L 54 20" />
    {/* buckle */}
    <path d="M 36 38 L 36 44 L 44 44 L 44 38" />
    <path d="M 38 41 L 42 41" />
    {/* side pocket */}
    <path className="thin" d="M 26 48 L 54 48" />
    <path className="thin" d="M 26 58 L 54 58" />
    {/* strap loop at top */}
    <path d="M 34 20 C 34 14, 46 14, 46 20" />
  </V>
);

const Crayon: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* crayon body held diagonally */}
    <path d="M 18 60 L 52 26 L 60 34 L 26 68 Z" />
    {/* tip (point) */}
    <path d="M 52 26 L 48 14 L 60 34" />
    {/* fist around it */}
    <path d="M 18 60 C 10 60, 8 68, 14 72 C 18 76, 28 74, 30 68 L 26 68 Z" />
    {/* knuckle lines */}
    <path className="thin" d="M 16 66 q 2 -1 4 1" />
    <path className="thin" d="M 20 70 q 2 -1 4 0" />
    {/* paper band on crayon */}
    <path className="thin" d="M 30 50 L 40 60" />
    <path className="thin" d="M 34 46 L 44 56" />
  </V>
);

const TeddyBear: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* head */}
    <circle cx="40" cy="28" r="12" />
    {/* ears */}
    <circle cx="30" cy="18" r="4" />
    <circle cx="50" cy="18" r="4" />
    {/* inner ears (thin) */}
    <circle className="thin" cx="30" cy="18" r="2" />
    <circle className="thin" cx="50" cy="18" r="2" />
    {/* snout */}
    <ellipse cx="40" cy="32" rx="5" ry="4" />
    {/* nose */}
    <path className="fill" d="M 40 29 q -2 0 -1.5 2 q 1.5 1 3 0 q 0.5 -2 -1.5 -2 Z" />
    {/* mouth */}
    <path className="thin" d="M 40 32 L 40 35 M 40 35 q -2 1 -3 0 M 40 35 q 2 1 3 0" />
    {/* eyes */}
    <circle className="fill" cx="35" cy="26" r="1" />
    <circle className="fill" cx="45" cy="26" r="1" />
    {/* body */}
    <path d="M 28 40 C 24 50, 26 62, 32 66 L 48 66 C 54 62, 56 50, 52 40" />
    {/* tummy patch */}
    <path className="thin" d="M 34 48 C 34 56, 46 56, 46 48" />
    {/* stitching */}
    <path className="thin" d="M 40 40 L 40 64" />
  </V>
);

/* ───────── II · Community ───────── */

const ChurchSteeple: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* steeple spire */}
    <path d="M 40 10 L 30 30 L 50 30 Z" />
    {/* cross on top */}
    <path d="M 40 10 L 40 4" />
    <path d="M 37 6 L 43 6" />
    {/* church body */}
    <path d="M 24 30 L 56 30 L 56 64 L 24 64 Z" />
    {/* door arch */}
    <path d="M 34 64 L 34 52 C 34 46, 46 46, 46 52 L 46 64" />
    {/* window arch */}
    <path d="M 32 40 C 32 36, 38 36, 38 40 L 38 46 L 32 46 Z" />
    <path d="M 42 40 C 42 36, 48 36, 48 40 L 48 46 L 42 46 Z" />
    {/* ground line */}
    <path className="thin" d="M 18 64 L 62 64" />
  </V>
);

const SoccerBall: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* ball */}
    <circle cx="40" cy="40" r="22" />
    {/* central pentagon (filled) */}
    <path className="fill" d="M 40 32 L 47 37 L 44.5 46 L 35.5 46 L 33 37 Z" />
    {/* three extending hex lines */}
    <path d="M 40 32 L 40 24" />
    <path d="M 47 37 L 55 34" />
    <path d="M 33 37 L 25 34" />
    <path d="M 44.5 46 L 50 54" />
    <path d="M 35.5 46 L 30 54" />
    {/* taegeuk star hint in upper-left of ball — tiny curve */}
    <path className="thin" d="M 28 26 q 4 -2 6 2 q -3 2 -6 -2 Z" />
  </V>
);

const RedDevilsScarf: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* scarf rectangle hanging at an angle */}
    <path d="M 14 22 L 58 14 L 66 58 L 22 66 Z" />
    {/* fringe — short vertical lines at bottom edge */}
    <path className="thin" d="M 26 66 L 27 72" />
    <path className="thin" d="M 34 65 L 35 71" />
    <path className="thin" d="M 42 64 L 43 70" />
    <path className="thin" d="M 50 63 L 51 69" />
    <path className="thin" d="M 58 62 L 59 68" />
    {/* "be the reds" style central band — tiny horns/star */}
    <path d="M 30 34 L 50 30" />
    <path d="M 30 44 L 50 40" />
    {/* little star in middle */}
    <path className="fill" d="M 40 38 l 1.2 2.4 l 2.6 0.3 l -2 1.8 l 0.5 2.6 l -2.3 -1.3 l -2.3 1.3 l 0.5 -2.6 l -2 -1.8 l 2.6 -0.3 Z" />
  </V>
);

const StainedGlass: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* arched window frame */}
    <path d="M 22 64 L 22 32 C 22 22, 58 22, 58 32 L 58 64 Z" />
    {/* vertical mullion */}
    <path d="M 40 64 L 40 22" />
    {/* horizontal mullion */}
    <path d="M 22 44 L 58 44" />
    {/* inner panels decorative diagonals */}
    <path className="thin" d="M 22 44 L 40 22" />
    <path className="thin" d="M 40 22 L 58 44" />
    <path className="thin" d="M 30 64 L 30 44" />
    <path className="thin" d="M 50 64 L 50 44" />
    {/* center rose */}
    <circle cx="40" cy="44" r="3" />
    <circle className="fill" cx="40" cy="44" r="1.2" />
    {/* base */}
    <path className="thin" d="M 18 64 L 62 64" />
  </V>
);

const HymnBook: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* open book — V shape at spine, pages fan out */}
    <path d="M 14 54 L 40 48 L 66 54" />
    <path d="M 14 54 L 14 28 L 40 22 L 40 48" />
    <path d="M 66 54 L 66 28 L 40 22" />
    {/* text lines on left page */}
    <path className="thin" d="M 20 32 L 34 30" />
    <path className="thin" d="M 20 36 L 34 34" />
    <path className="thin" d="M 20 40 L 34 38" />
    {/* text lines on right */}
    <path className="thin" d="M 46 30 L 60 32" />
    <path className="thin" d="M 46 34 L 60 36" />
    <path className="thin" d="M 46 38 L 60 40" />
    {/* ribbon bookmark */}
    <path d="M 40 22 L 40 62" />
    <path className="thin" d="M 38 62 L 42 62 L 40 66 Z" />
  </V>
);

/* ───────── III · Together ───────── */

const TwoCups: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* left cup */}
    <path d="M 14 36 L 14 54 C 14 60, 20 62, 26 62 C 32 62, 36 60, 36 54 L 36 36 Z" />
    <path d="M 36 40 C 42 40, 44 44, 44 48 C 44 52, 42 56, 36 56" />
    {/* right cup */}
    <path d="M 46 42 L 46 56 C 46 62, 52 64, 58 64 C 64 64, 66 62, 66 56 L 66 42 Z" />
    <path d="M 66 46 C 70 46, 72 49, 72 52 C 72 55, 70 58, 66 58" />
    {/* steam — two wisps */}
    <path className="thin" d="M 22 30 q -3 -4 0 -8 q 3 -4 0 -8" />
    <path className="thin" d="M 28 30 q -3 -4 0 -8" />
    <path className="thin" d="M 54 36 q -3 -4 0 -8 q 3 -4 0 -8" />
    {/* saucer lines */}
    <path className="thin" d="M 12 62 L 38 62" />
  </V>
);

const Umbrella: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* dome */}
    <path d="M 14 38 C 20 20, 60 20, 66 38 Z" />
    {/* scallops */}
    <path d="M 14 38 q 6 6 13 0" />
    <path d="M 27 38 q 6 6 13 0" />
    <path d="M 40 38 q 6 6 13 0" />
    <path d="M 53 38 q 6 6 13 0" />
    {/* tip */}
    <path d="M 40 20 L 40 14" />
    {/* shaft */}
    <path d="M 40 38 L 40 64" />
    {/* handle (J-curve) */}
    <path d="M 40 64 C 40 72, 32 72, 32 64" />
    {/* two tiny raindrops */}
    <path className="thin" d="M 18 50 l 0 4 M 20 52 l 0 4" />
    <path className="thin" d="M 62 50 l 0 4" />
  </V>
);

const Suitcase: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* handle */}
    <path d="M 32 22 C 32 16, 48 16, 48 22" />
    {/* case body */}
    <path d="M 14 22 L 66 22 L 66 62 L 14 62 Z" />
    {/* center divider */}
    <path d="M 14 40 L 66 40" />
    {/* latches */}
    <path d="M 26 22 L 26 28 L 32 28 L 32 22" />
    <path d="M 48 22 L 48 28 L 54 28 L 54 22" />
    {/* travel stickers (tiny rectangles) */}
    <path className="thin" d="M 22 50 L 30 48 L 31 56 L 23 58 Z" />
    <path className="thin" d="M 40 46 L 52 48 L 51 58 L 39 56 Z" />
    {/* corner rivets */}
    <circle className="fill" cx="18" cy="26" r="0.9" />
    <circle className="fill" cx="62" cy="26" r="0.9" />
    <circle className="fill" cx="18" cy="58" r="0.9" />
    <circle className="fill" cx="62" cy="58" r="0.9" />
  </V>
);

const ConcertTicket: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* ticket rotated slightly */}
    <g transform="rotate(-8 40 40)">
      <path d="M 10 30 L 70 30 L 70 50 L 10 50 Z" />
      {/* perforation between stub and body */}
      <path className="thin" d="M 54 32 L 54 34 M 54 36 L 54 38 M 54 40 L 54 42 M 54 44 L 54 46 M 54 48 L 54 50" />
      {/* text lines on left body */}
      <path className="thin" d="M 16 36 L 48 36" />
      <path className="thin" d="M 16 40 L 40 40" />
      <path className="thin" d="M 16 44 L 44 44" />
      {/* stub seat/row */}
      <path className="thin" d="M 58 38 L 66 38" />
      <path className="thin" d="M 58 42 L 66 42" />
    </g>
  </V>
);

const Passport: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* passport booklet */}
    <path d="M 22 14 L 58 14 L 58 66 L 22 66 Z" />
    {/* inner seam */}
    <path className="thin" d="M 26 14 L 26 66" />
    {/* emblem — circle with star */}
    <circle cx="40" cy="30" r="8" />
    <path className="thin" d="M 36 30 L 44 30 M 40 26 L 40 34" />
    {/* rays */}
    <path className="thin" d="M 34 30 q -2 0 -2 -2" />
    <path className="thin" d="M 46 30 q 2 0 2 -2" />
    {/* text bar */}
    <path d="M 32 46 L 48 46" />
    <path className="thin" d="M 30 52 L 50 52" />
    <path className="thin" d="M 30 56 L 50 56" />
    <path className="thin" d="M 32 60 L 48 60" />
  </V>
);

const NycSkyline: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* skyline silhouette — varied heights */}
    <path d="M 10 58
             L 10 42 L 16 42 L 16 34 L 22 34 L 22 40 L 26 40 L 26 28
             L 30 28 L 30 24 L 34 24 L 34 32 L 40 32 L 40 18 L 44 18
             L 44 14 L 46 14 L 46 18 L 50 18 L 50 32 L 56 32 L 56 38
             L 60 38 L 60 30 L 64 30 L 64 40 L 70 40 L 70 58 Z" />
    {/* window dots */}
    <circle className="fill" cx="20" cy="44" r="0.8" />
    <circle className="fill" cx="24" cy="36" r="0.8" />
    <circle className="fill" cx="32" cy="34" r="0.8" />
    <circle className="fill" cx="42" cy="26" r="0.8" />
    <circle className="fill" cx="48" cy="24" r="0.8" />
    <circle className="fill" cx="52" cy="38" r="0.8" />
    <circle className="fill" cx="62" cy="44" r="0.8" />
    {/* ground */}
    <path className="thin" d="M 6 58 L 74 58" />
    {/* tiny antenna on tallest (empire state hint) */}
    <path className="thin" d="M 45 14 L 45 8" />
  </V>
);

const GalleryFrame: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* outer frame */}
    <path d="M 14 16 L 66 16 L 66 60 L 14 60 Z" />
    {/* inner matting */}
    <path d="M 22 24 L 58 24 L 58 52 L 22 52 Z" />
    {/* tiny abstract painting inside — two shapes */}
    <path className="thin" d="M 26 40 C 30 32, 38 30, 42 38" />
    <circle className="thin" cx="50" cy="32" r="3" />
    {/* wall nail shadow line below */}
    <path className="thin" d="M 38 14 L 42 14" />
    <path className="thin" d="M 40 14 L 40 10" />
    {/* tiny plaque below */}
    <path className="thin" d="M 32 64 L 48 64" />
  </V>
);

const SubwayMap: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* piece of paper (torn edge top) */}
    <path d="M 14 20 q 6 -4 12 0 q 6 4 12 0 q 6 -4 12 0 q 6 4 12 0 L 62 66 L 18 66 Z" />
    {/* two routes — curved lines */}
    <path d="M 20 32 C 34 36, 46 28, 60 36" />
    <path d="M 22 48 C 36 44, 48 54, 60 50" />
    {/* stations — small circles */}
    <circle className="fill" cx="24" cy="33" r="1.4" />
    <circle className="fill" cx="38" cy="32" r="1.4" />
    <circle className="fill" cx="52" cy="33" r="1.4" />
    <circle className="fill" cx="28" cy="47" r="1.4" />
    <circle className="fill" cx="44" cy="51" r="1.4" />
    <circle className="fill" cx="56" cy="50" r="1.4" />
    {/* tiny "L" mark */}
    <path className="thin" d="M 50 58 L 50 62 L 54 62" />
  </V>
);

/* ───────── IV · Milestones ───────── */

const MilitaryHat: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* peaked cap crown */}
    <path d="M 18 34 C 22 22, 58 22, 62 34 L 62 46 L 18 46 Z" />
    {/* band below crown */}
    <path d="M 16 46 L 64 46 L 64 52 L 16 52 Z" />
    {/* visor */}
    <path d="M 12 52 C 20 60, 60 60, 68 52" />
    {/* central star on band */}
    <path className="fill" d="M 40 48 l 1.2 2.4 l 2.6 0.3 l -2 1.8 l 0.5 2.6 l -2.3 -1.3 l -2.3 1.3 l 0.5 -2.6 l -2 -1.8 l 2.6 -0.3 Z" />
    {/* strap detail */}
    <path className="thin" d="M 22 52 L 58 52" />
    {/* stitching on crown */}
    <path className="thin" d="M 22 38 C 30 36, 50 36, 58 38" />
  </V>
);

const GradCap: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* mortarboard top (diamond) */}
    <path d="M 40 16 L 12 28 L 40 40 L 68 28 Z" />
    {/* cap underside band */}
    <path d="M 22 32 L 22 46 C 22 50, 40 54, 58 50 L 58 32" />
    {/* button in center */}
    <circle className="fill" cx="40" cy="28" r="1.5" />
    {/* tassel cord */}
    <path d="M 40 28 L 60 32 L 60 48" />
    {/* tassel fringe */}
    <path className="thin" d="M 58 48 L 58 56" />
    <path className="thin" d="M 60 48 L 60 58" />
    <path className="thin" d="M 62 48 L 62 56" />
    <path className="thin" d="M 56 48 L 56 54" />
  </V>
);

const Diploma: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* rolled scroll — two scrolled ends and middle */}
    <path d="M 14 30 C 14 22, 22 22, 22 30 L 22 50 C 22 58, 14 58, 14 50 Z" />
    <path d="M 58 30 C 58 22, 66 22, 66 30 L 66 50 C 66 58, 58 58, 58 50 Z" />
    {/* middle parchment */}
    <path d="M 22 26 L 58 26 L 58 54 L 22 54 Z" />
    {/* text lines */}
    <path className="thin" d="M 28 34 L 52 34" />
    <path className="thin" d="M 28 40 L 52 40" />
    <path className="thin" d="M 28 46 L 46 46" />
    {/* ribbon (hanging seal) */}
    <circle className="fill" cx="40" cy="62" r="2" />
    <path className="thin" d="M 40 54 L 40 60" />
    <path className="thin" d="M 38 64 L 36 70" />
    <path className="thin" d="M 42 64 L 44 70" />
  </V>
);

const RingBox: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* open velvet box — lid back, base front */}
    <path d="M 18 34 L 62 34 L 58 20 L 22 20 Z" />
    {/* base of box */}
    <path d="M 14 34 L 66 34 L 66 60 L 14 60 Z" />
    {/* ring inside (oval) */}
    <circle cx="40" cy="44" r="8" />
    <circle className="thin" cx="40" cy="44" r="5.5" />
    {/* diamond on ring top */}
    <path d="M 40 34 L 36 38 L 40 42 L 44 38 Z" />
    <path className="fill" d="M 40 36 L 38 38 L 40 40 L 42 38 Z" />
    {/* hinge line */}
    <path className="thin" d="M 22 34 L 58 34" />
  </V>
);

const Letter: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* envelope rectangle */}
    <path d="M 14 24 L 66 24 L 66 58 L 14 58 Z" />
    {/* flap triangles */}
    <path d="M 14 24 L 40 44 L 66 24" />
    {/* small seal / wax dot */}
    <circle className="fill" cx="40" cy="44" r="2" />
    {/* paper poking slightly out top */}
    <path className="thin" d="M 24 20 L 56 20" />
    <path className="thin" d="M 26 16 L 54 16" />
  </V>
);

/* ───────── V · Today ───────── */

const Bouquet: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* central rose (spiral) */}
    <path d="M 40 30 C 36 30, 36 26, 40 26 C 46 26, 46 34, 38 34 C 32 34, 32 24, 42 24" />
    {/* left flower (simple petals) */}
    <circle cx="28" cy="30" r="4" />
    <circle className="thin" cx="28" cy="30" r="2" />
    {/* right flower */}
    <circle cx="52" cy="32" r="4" />
    <circle className="thin" cx="52" cy="32" r="2" />
    {/* two leaves */}
    <path d="M 24 40 C 18 40, 16 48, 22 48 C 26 46, 26 42, 24 40 Z" />
    <path d="M 56 42 C 62 42, 64 50, 58 50 C 54 48, 54 44, 56 42 Z" />
    {/* stems bundle */}
    <path d="M 40 34 L 40 60" />
    <path d="M 36 34 L 38 60" />
    <path d="M 44 34 L 42 60" />
    {/* ribbon wrapped around */}
    <path d="M 34 50 L 46 50" />
    <path d="M 34 50 L 34 56 L 46 56 L 46 50" />
    {/* ribbon tails */}
    <path className="thin" d="M 34 56 L 30 64" />
    <path className="thin" d="M 46 56 L 50 64" />
  </V>
);

const LinkedRings: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* two interlocking rings */}
    <circle cx="30" cy="40" r="14" />
    <circle cx="50" cy="40" r="14" />
    {/* subtle inner stroke hint (diamonds on rings) */}
    <path className="fill" d="M 30 26 l 1 2 l 2 0.3 l -1.5 1.5 l 0.4 2 l -1.9 -1 l -1.9 1 l 0.4 -2 l -1.5 -1.5 l 2 -0.3 Z" />
    <path className="fill" d="M 50 26 l 1 2 l 2 0.3 l -1.5 1.5 l 0.4 2 l -1.9 -1 l -1.9 1 l 0.4 -2 l -1.5 -1.5 l 2 -0.3 Z" />
    {/* linking overlap — subtle highlight */}
    <path className="thin" d="M 40 40 q -2 -4 0 -8 q 2 4 0 8" opacity="0" />
  </V>
);

const EnvelopeSealed: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* envelope */}
    <path d="M 14 22 L 66 22 L 66 58 L 14 58 Z" />
    {/* closed flap lines (V meeting in middle) */}
    <path d="M 14 22 L 40 40 L 66 22" />
    <path d="M 14 58 L 38 40" />
    <path d="M 66 58 L 42 40" />
    {/* wax seal — central circle with star */}
    <circle cx="40" cy="40" r="5" />
    <path className="fill" d="M 40 36.5 l 1 2 l 2 0.3 l -1.5 1.5 l 0.4 2 l -1.9 -1 l -1.9 1 l 0.4 -2 l -1.5 -1.5 l 2 -0.3 Z" />
  </V>
);

const OpenWindow: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* frame */}
    <path d="M 16 14 L 64 14 L 64 66 L 16 66 Z" />
    {/* mullions */}
    <path d="M 40 14 L 40 66" />
    <path d="M 16 40 L 64 40" />
    {/* open window sash (ajar, right panel tilted) */}
    <path className="thin" d="M 40 14 L 60 18 L 60 38 L 40 40" />
    {/* light beams */}
    <path className="thin" d="M 40 14 L 30 34" />
    <path className="thin" d="M 46 16 L 38 36" />
    <path className="thin" d="M 52 18 L 46 38" />
    {/* curtain hint at left */}
    <path className="thin" d="M 20 18 q 4 6 0 10 q -4 6 0 10" />
  </V>
);

const Wildflower: React.FC<IconProps> = (p) => (
  <V {...p}>
    {/* stem */}
    <path d="M 40 66 C 40 54, 38 46, 40 34" />
    {/* leaves */}
    <path d="M 40 48 C 32 46, 28 50, 30 54 C 34 54, 38 52, 40 50" />
    <path d="M 40 54 C 48 52, 52 56, 50 60 C 46 60, 42 58, 40 56" />
    {/* flower petals (5) */}
    <circle cx="40" cy="28" r="4" />
    <circle cx="32" cy="24" r="4" />
    <circle cx="48" cy="24" r="4" />
    <circle cx="34" cy="32" r="4" />
    <circle cx="46" cy="32" r="4" />
    {/* center */}
    <circle className="fill" cx="40" cy="28" r="2" />
  </V>
);

// ─── Export ───

export const ERA_ICONS: Record<string, React.FC<IconProps>> = {
  "rocking-horse": RockingHorse,
  "birthday-cake": BirthdayCake,
  "school-backpack": SchoolBackpack,
  "crayon": Crayon,
  "teddy-bear": TeddyBear,
  "church-steeple": ChurchSteeple,
  "soccer-ball": SoccerBall,
  "red-devils": RedDevilsScarf,
  "stained-glass": StainedGlass,
  "hymn-book": HymnBook,
  "two-cups": TwoCups,
  "umbrella": Umbrella,
  "suitcase": Suitcase,
  "concert-ticket": ConcertTicket,
  "passport": Passport,
  "nyc-skyline": NycSkyline,
  "gallery-frame": GalleryFrame,
  "subway-map": SubwayMap,
  "military-hat": MilitaryHat,
  "grad-cap": GradCap,
  "diploma": Diploma,
  "ring-box": RingBox,
  "letter": Letter,
  "bouquet": Bouquet,
  "linked-rings": LinkedRings,
  "envelope-sealed": EnvelopeSealed,
  "open-window": OpenWindow,
  "wildflower": Wildflower,
};

export type EraIconKey = keyof typeof ERA_ICONS;

// Display labels (for editor dropdown)
export const ERA_ICON_LABELS: Record<string, string> = {
  "rocking-horse": "흔들목마", "birthday-cake": "생일케이크", "school-backpack": "책가방",
  "crayon": "크레용", "teddy-bear": "곰인형",
  "church-steeple": "교회 첨탑", "soccer-ball": "축구공", "red-devils": "붉은악마 스카프",
  "stained-glass": "스테인드글라스", "hymn-book": "찬송가",
  "two-cups": "커피잔 둘", "umbrella": "우산", "suitcase": "여행가방",
  "concert-ticket": "공연 티켓", "passport": "여권", "nyc-skyline": "뉴욕 스카이라인",
  "gallery-frame": "갤러리 액자", "subway-map": "지하철 노선도",
  "military-hat": "군모", "grad-cap": "학사모", "diploma": "졸업장", "ring-box": "반지 케이스", "letter": "손편지",
  "bouquet": "부케", "linked-rings": "반지 두 개", "envelope-sealed": "봉인 편지", "open-window": "열린 창", "wildflower": "들꽃",
};
