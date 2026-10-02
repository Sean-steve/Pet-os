import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Dog,
  FlaskConical,
  Footprints,
  HeartPulse,
  Home,
  MapPin,
  Menu,
  MoreHorizontal,
  Package,
  PawPrint,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Syringe,
  Users,
  Utensils,
  X,
} from 'lucide-react';

type ProductSection =
  | 'home'
  | 'pets'
  | 'health'
  | 'care'
  | 'activity'
  | 'tracking'
  | 'services'
  | 'store'
  | 'community';

interface PetOSExperienceProps {
  onOpenLab: () => void;
}

const navItems: Array<{ id: ProductSection; label: string; icon: React.ElementType }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'pets', label: 'My pets', icon: PawPrint },
  { id: 'health', label: 'Health', icon: HeartPulse },
  { id: 'care', label: 'Care', icon: Calendar },
  { id: 'activity', label: 'Activity', icon: Footprints },
  { id: 'tracking', label: 'Tracking', icon: MapPin },
  { id: 'services', label: 'Services', icon: Stethoscope },
  { id: 'store', label: 'Store', icon: ShoppingBag },
  { id: 'community', label: 'Community', icon: Users },
];

const sectionCopy: Record<ProductSection, { eyebrow: string; title: string; description: string }> = {
  home: {
    eyebrow: 'Tuesday · 2 October',
    title: 'Good morning, Steve.',
    description: 'Max is doing well. Here is what matters today.',
  },
  pets: {
    eyebrow: 'Pet identity',
    title: 'Everything about Max, in one place.',
    description: 'A living profile that moves with him across care, services and recovery.',
  },
  health: {
    eyebrow: 'Health',
    title: 'Clear records. Calm decisions.',
    description: 'Clinical history, medication, vaccines and appointments — with provenance intact.',
  },
  care: {
    eyebrow: 'Care plan',
    title: 'A day that keeps itself together.',
    description: 'Meals, medication, grooming and household care without the mental overhead.',
  },
  activity: {
    eyebrow: 'Activity',
    title: 'See the rhythm, not just the steps.',
    description: 'Walks, training and enrichment across the week.',
  },
  tracking: {
    eyebrow: 'Location',
    title: 'Know where Max is — and what the tracker actually knows.',
    description: 'Live state, safe zones and device health kept clearly separate.',
  },
  services: {
    eyebrow: 'Services',
    title: 'Trusted care, without the back-and-forth.',
    description: 'Discover, book and manage verified pet professionals.',
  },
  store: {
    eyebrow: 'Marketplace',
    title: 'Useful things for Max, not endless noise.',
    description: 'Curated pet essentials with transparent sellers, fulfillment and returns.',
  },
  community: {
    eyebrow: 'Community',
    title: 'A safer local network for pets and people.',
    description: 'Groups, events and recovery alerts designed around privacy.',
  },
};

const IconTile = ({ icon: Icon, tone = 'sage' }: { icon: React.ElementType; tone?: 'sage' | 'peach' | 'violet' | 'blue' }) => {
  const tones = {
    sage: 'bg-[#E3F1E9] text-[#2F6B50]',
    peach: 'bg-[#FFF0E8] text-[#B85F43]',
    violet: 'bg-[#EEEAFE] text-[#6959B7]',
    blue: 'bg-[#E8F1FB] text-[#426E9B]',
  };
  return (
    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${tones[tone]}`}>
      <Icon className="h-5 w-5" />
    </span>
  );
};

const Pill = ({ children, tone = 'sage' }: { children: React.ReactNode; tone?: 'sage' | 'peach' | 'neutral' }) => {
  const tones = {
    sage: 'bg-[#E8F4ED] text-[#2F6B50]',
    peach: 'bg-[#FFF0E8] text-[#A95038]',
    neutral: 'bg-[#F2F3F0] text-[#65706A]',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
};

const StatCard = ({
  label,
  value,
  detail,
  icon,
  tone = 'sage',
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  tone?: 'sage' | 'peach' | 'violet' | 'blue';
}) => (
  <div className="rounded-[22px] border border-[#E7E9E4] bg-white p-5 shadow-[0_12px_35px_rgba(37,54,46,0.05)]">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#8A938E]">{label}</p>
        <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#1B2A23]">{value}</p>
        <p className="mt-1 text-sm text-[#77817C]">{detail}</p>
      </div>
      <IconTile icon={icon} tone={tone} />
    </div>
  </div>
);

const Surface = ({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <section className={`rounded-[26px] border border-[#E7E9E4] bg-white shadow-[0_18px_50px_rgba(37,54,46,0.055)] ${className}`}>
    {children}
  </section>
);

const ProgressRing = ({ value }: { value: number }) => {
  const deg = Math.max(0, Math.min(100, value)) * 3.6;
  return (
    <div
      className="grid h-16 w-16 place-items-center rounded-full"
      style={{ background: `conic-gradient(#2F6B50 ${deg}deg, #E7EEE9 ${deg}deg)` }}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-sm font-semibold text-[#1B2A23]">{value}%</div>
    </div>
  );
};

const TaskRow = ({
  icon: Icon,
  title,
  subtitle,
  time,
  done = false,
  tone = 'sage',
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  time: string;
  done?: boolean;
  tone?: 'sage' | 'peach' | 'violet' | 'blue';
}) => (
  <div className="flex items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-[#F8F9F7]">
    <IconTile icon={Icon} tone={tone} />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className={`truncate text-sm font-semibold ${done ? 'text-[#93A099] line-through' : 'text-[#23322B]'}`}>{title}</p>
        {done && <CheckCircle2 className="h-4 w-4 text-[#4F8A6B]" />}
      </div>
      <p className="truncate text-xs text-[#8A938E]">{subtitle}</p>
    </div>
    <span className="text-xs font-medium text-[#7A847F]">{time}</span>
  </div>
);

const SectionHeader = ({ section }: { section: ProductSection }) => {
  const copy = sectionCopy[section];
  return (
    <div className="mb-7 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5E8C72]">{copy.eyebrow}</p>
        <h1 className="mt-2 max-w-3xl text-[30px] font-semibold tracking-[-0.045em] text-[#1B2A23] md:text-[38px]">{copy.title}</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#748079]">{copy.description}</p>
      </div>
      {section !== 'home' && (
        <button className="mt-2 inline-flex items-center gap-2 self-start rounded-2xl bg-[#1F5F46] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#184D39] md:mt-0">
          <Plus className="h-4 w-4" />
          Add new
        </button>
      )}
    </div>
  );
};

const HomeView = () => (
  <>
    <SectionHeader section="home" />

    <div className="grid gap-5 xl:grid-cols-[1.45fr_0.85fr]">
      <div className="relative overflow-hidden rounded-[30px] bg-[#173F31] p-6 text-white shadow-[0_24px_70px_rgba(23,63,49,0.22)] md:p-8">
        <div className="absolute -right-14 -top-16 h-56 w-56 rounded-full bg-[#4D8A6C]/35 blur-2xl" />
        <div className="absolute -bottom-20 right-28 h-44 w-44 rounded-full bg-[#E2B769]/20 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-[28px] border border-white/15 bg-white/10 shadow-inner">
              <Dog className="h-12 w-12 text-[#F3EBDD]" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-3xl font-semibold tracking-[-0.04em]">Max</h2>
                <Pill tone="sage">All good today</Pill>
              </div>
              <p className="mt-1 text-sm text-[#BDD0C6]">Golden Retriever · 4 years · 31.2 kg</p>
              <div className="mt-5 flex flex-wrap gap-3 text-xs">
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[#DCE8E2]">Microchip linked</span>
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[#DCE8E2]">Vaccines current</span>
                <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[#DCE8E2]">Tracker online</span>
              </div>
            </div>
          </div>

          <div className="min-w-[210px] rounded-[24px] border border-white/10 bg-white/8 p-4 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9EB9AB]">Next up</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10">
                <Footprints className="h-5 w-5 text-[#F4D899]" />
              </div>
              <div>
                <p className="text-sm font-semibold">Evening walk</p>
                <p className="text-xs text-[#AFC5BA]">6:30 PM · 45 min</p>
              </div>
            </div>
            <button className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#F4D899]">
              Open today’s plan <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[30px] border border-[#DDE6E0] bg-[#EDF5F0] p-6">
        <div className="flex items-center justify-between">
          <IconTile icon={Sparkles} tone="violet" />
          <Pill tone="neutral">Pet OS AI</Pill>
        </div>
        <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-[#20332A]">Ask anything about Max.</h3>
        <p className="mt-2 text-sm leading-6 text-[#6D7B74]">Answers stay grounded in his records and show where the information came from.</p>
        <button className="mt-5 flex w-full items-center justify-between rounded-2xl border border-[#D7E3DB] bg-white px-4 py-3 text-left text-sm text-[#88928D] shadow-sm">
          “What should I know today?”
          <ArrowUpRight className="h-4 w-4 text-[#4D7C64]" />
        </button>
      </div>
    </div>

    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Care today" value="4 of 6" detail="Two tasks remaining" icon={Calendar} tone="sage" />
      <StatCard label="Activity" value="58 min" detail="+12% vs. last week" icon={Activity} tone="blue" />
      <StatCard label="Health" value="Up to date" detail="Next review in 18 days" icon={HeartPulse} tone="peach" />
      <StatCard label="Tracker" value="Online" detail="Home · updated 2 min ago" icon={MapPin} tone="violet" />
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
      <Surface className="p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#87918C]">Today</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#1B2A23]">Care plan</h3>
          </div>
          <ProgressRing value={67} />
        </div>
        <div className="mt-4 divide-y divide-[#EFF1EE]">
          <TaskRow icon={Utensils} title="Breakfast" subtitle="Adult formula · 340 g" time="7:30 AM" done tone="peach" />
          <TaskRow icon={Syringe} title="Medication" subtitle="As recorded by your vet" time="8:00 AM" done tone="violet" />
          <TaskRow icon={Footprints} title="Morning walk" subtitle="Neighbourhood route · 31 min" time="8:35 AM" done tone="blue" />
          <TaskRow icon={Utensils} title="Dinner" subtitle="Adult formula · 340 g" time="5:45 PM" tone="peach" />
          <TaskRow icon={Footprints} title="Evening walk" subtitle="Target · 45 min" time="6:30 PM" tone="sage" />
        </div>
      </Surface>

      <Surface className="overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 md:px-6 md:pt-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#87918C]">Tracking</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#1B2A23]">Max is at home</h3>
          </div>
          <button className="rounded-full border border-[#E4E8E4] p-2 text-[#68756E]"><MoreHorizontal className="h-4 w-4" /></button>
        </div>
        <div className="relative mx-5 mt-5 h-44 overflow-hidden rounded-[22px] bg-[#E9EFEA] md:mx-6">
          <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'linear-gradient(#D4DED7 1px, transparent 1px), linear-gradient(90deg, #D4DED7 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          <div className="absolute left-[18%] top-[26%] h-[2px] w-[68%] rotate-[12deg] bg-[#C1D2C7]" />
          <div className="absolute left-[36%] top-[62%] h-[2px] w-[54%] -rotate-[18deg] bg-[#CAD8CF]" />
          <div className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#1F5F46] shadow-[0_8px_22px_rgba(31,95,70,0.28)] ring-8 ring-white/70">
            <PawPrint className="h-6 w-6 text-white" />
          </div>
          <div className="absolute bottom-3 left-3 rounded-xl bg-white/90 px-3 py-2 text-xs font-medium text-[#34443C] shadow-sm backdrop-blur">
            Home safe zone
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-5 md:px-6">
          <div className="flex items-center gap-2 text-sm text-[#64716A]">
            <span className="h-2 w-2 rounded-full bg-[#3F8B62]" />
            GPS active · updated 2 min ago
          </div>
          <button className="text-sm font-semibold text-[#2F6B50]">Open map</button>
        </div>
      </Surface>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-3">
      <Surface className="p-5 md:p-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#87918C]">This week</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#1B2A23]">Activity rhythm</h3>
          </div>
          <Pill tone="sage">On track</Pill>
        </div>
        <div className="mt-7 flex h-36 items-end gap-3">
          {[52, 68, 44, 78, 61, 86, 72].map((height, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex h-28 w-full items-end rounded-xl bg-[#F0F3F0]">
                <div className="w-full rounded-xl bg-[#5E8C72]" style={{ height: `${height}%`, opacity: index === 5 ? 1 : 0.62 }} />
              </div>
              <span className="text-[11px] font-medium text-[#909994]">{['M','T','W','T','F','S','S'][index]}</span>
            </div>
          ))}
        </div>
      </Surface>

      <Surface className="p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#87918C]">Upcoming</p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[#1B2A23]">Care & services</h3>
          </div>
          <Calendar className="h-5 w-5 text-[#668173]" />
        </div>
        <div className="mt-5 space-y-4">
          {[
            ['14 Oct', 'Annual wellness visit', 'Westlands Vet Centre'],
            ['19 Oct', 'Grooming', 'Paws & Polish'],
            ['26 Oct', 'Training session', 'Recall & leash work'],
          ].map(([date, title, meta]) => (
            <div key={title} className="flex gap-3">
              <div className="grid h-11 w-12 shrink-0 place-items-center rounded-2xl bg-[#F2F5F2] text-xs font-bold text-[#4E6458]">{date}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#28372F]">{title}</p>
                <p className="truncate text-xs text-[#8A938E]">{meta}</p>
              </div>
            </div>
          ))}
        </div>
        <button className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#2F6B50]">View calendar <ChevronRight className="h-4 w-4" /></button>
      </Surface>
    </div>
  </>
);

const FeatureView = ({ section }: { section: Exclude<ProductSection, 'home'> }) => {
  const configs = {
    pets: {
      stats: [
        ['Identity', 'Verified', 'Microchip + household', PawPrint, 'sage'],
        ['Passport', 'Ready', 'Shareable care record', ShieldCheck, 'blue'],
        ['Documents', '12', '3 added this year', Package, 'violet'],
        ['Household', '3 people', '2 active caregivers', Users, 'peach'],
      ],
      primaryTitle: 'Max’s digital twin',
      primaryText: 'One canonical profile powers health, care, tracking, services and recovery — without duplicating his identity across modules.',
      rows: ['Golden Retriever · Male · 4 years', '31.2 kg · updated 18 Sep', 'Microchip 985…342 · verified', 'Household: Nyaga Home'],
    },
    health: {
      stats: [
        ['Vaccines', 'Current', 'Next review 20 Oct', Syringe, 'sage'],
        ['Medication', '1 active', 'Vet-authored schedule', FlaskConical, 'violet'],
        ['Records', '18', 'From 3 providers', HeartPulse, 'peach'],
        ['Next visit', '18 days', 'Routine wellness', Calendar, 'blue'],
      ],
      primaryTitle: 'Health record',
      primaryText: 'Provider-authored facts, owner observations and AI explanations stay visibly distinct, so the record remains trustworthy.',
      rows: ['Annual wellness · booked 20 Oct', 'Flea & tick preventive · current', 'Weight trend · stable over 90 days', 'Allergy record · chicken protein'],
    },
    care: {
      stats: [
        ['Today', '6 tasks', '4 completed', Calendar, 'sage'],
        ['Meals', '2 / day', 'Plan active', Utensils, 'peach'],
        ['Medication', '2 / day', 'No missed doses', FlaskConical, 'violet'],
        ['Caregivers', '2', 'Shared execution', Users, 'blue'],
      ],
      primaryTitle: 'Today’s care',
      primaryText: 'A shared execution layer keeps meals, medication, grooming and daily routines aligned across the household.',
      rows: ['Dinner · 5:45 PM', 'Evening walk · 6:30 PM', 'Medication · 8:00 PM', 'Brush coat · tomorrow'],
    },
    activity: {
      stats: [
        ['This week', '327 min', '+8% vs last week', Activity, 'sage'],
        ['Walks', '9', '6.1 km recorded', Footprints, 'blue'],
        ['Training', '4 sessions', 'Recall improving', Dog, 'violet'],
        ['Rest', 'Normal', 'No unusual pattern', Clock, 'peach'],
      ],
      primaryTitle: 'Weekly rhythm',
      primaryText: 'Activity stays factual: walks, play, rest and training sessions — without turning sparse data into health diagnoses.',
      rows: ['Morning walk · 31 min', 'Recall training · 18 min', 'Enrichment play · 22 min', 'Evening walk · scheduled'],
    },
    tracking: {
      stats: [
        ['Device', 'Online', 'Battery 74%', MapPin, 'sage'],
        ['Last update', '2 min ago', 'GPS source', Clock, 'blue'],
        ['Safe zones', '2', 'Home + Daycare', ShieldCheck, 'violet'],
        ['Plan', 'Active', 'Connectivity current', Activity, 'peach'],
      ],
      primaryTitle: 'Live location',
      primaryText: 'Pet OS separates billing, network service and actual device health, so “active plan” never gets mistaken for “live GPS”.',
      rows: ['Home safe zone · inside', 'GPS · fresh', 'Battery · 74%', 'Lost Pet mode · inactive'],
    },
    services: {
      stats: [
        ['Upcoming', '3', 'Next on 14 Oct', Calendar, 'sage'],
        ['Trusted pros', '7', 'Saved providers', Stethoscope, 'blue'],
        ['Bookings', '21', 'Across 5 categories', CheckCircle2, 'violet'],
        ['Open issue', '0', 'Everything resolved', ShieldCheck, 'peach'],
      ],
      primaryTitle: 'Care team',
      primaryText: 'Book verified vets, trainers, groomers, sitters, walkers and transport — then keep service execution connected to Max’s record.',
      rows: ['Westlands Vet Centre · 14 Oct', 'Paws & Polish · 19 Oct', 'Recall trainer · 26 Oct', 'Browse trusted providers'],
    },
    store: {
      stats: [
        ['Orders', '6', '1 in transit', Package, 'sage'],
        ['Saved', '14', 'Across 5 categories', ShoppingBag, 'blue'],
        ['Returns', '0', 'No open returns', CheckCircle2, 'violet'],
        ['Sellers', '8', 'Verified marketplace', ShieldCheck, 'peach'],
      ],
      primaryTitle: 'Marketplace',
      primaryText: 'A commerce layer for pet essentials with seller verification, inventory truth, returns and payout controls built in.',
      rows: ['Joint-support bed · arriving Friday', 'Harness · saved for later', 'Adult formula · in stock', 'Tracker collar mount · compatible'],
    },
    community: {
      stats: [
        ['Nearby', '4 groups', 'Within your area', Users, 'sage'],
        ['Events', '3', 'This month', Calendar, 'blue'],
        ['Recovery', '0 alerts', 'No nearby active alert', ShieldCheck, 'violet'],
        ['Following', '18', 'People & groups', PawPrint, 'peach'],
      ],
      primaryTitle: 'Local pet network',
      primaryText: 'Community is useful without becoming noisy: groups, events and recovery alerts stay privacy-aware and secondary to care.',
      rows: ['Weekend social walk · Saturday', 'Golden Retriever owners · 248 members', 'Pet first-aid workshop · 18 Oct', 'No active recovery alert nearby'],
    },
  } as const;

  const c = configs[section];

  return (
    <>
      <SectionHeader section={section} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {c.stats.map(([label, value, detail, Icon, tone]) => (
          <StatCard key={label as string} label={label as string} value={value as string} detail={detail as string} icon={Icon as React.ElementType} tone={tone as any} />
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Surface className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Pill tone="sage">Live overview</Pill>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-[#1B2A23]">{c.primaryTitle}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#748079]">{c.primaryText}</p>
            </div>
            <button className="rounded-full border border-[#E6E9E5] p-2.5 text-[#617068]"><MoreHorizontal className="h-4 w-4" /></button>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {c.rows.map((row, i) => (
              <div key={row} className="flex items-center gap-3 rounded-2xl border border-[#EDF0EC] bg-[#FAFBF9] px-4 py-4">
                <span className={`h-2.5 w-2.5 rounded-full ${i === 0 ? 'bg-[#3F8B62]' : 'bg-[#C8D1CC]'}`} />
                <span className="text-sm font-medium text-[#425149]">{row}</span>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="p-6">
          <div className="flex items-center gap-3">
            <IconTile icon={Sparkles} tone="violet" />
            <div>
              <p className="text-sm font-semibold text-[#26362E]">Pet OS intelligence</p>
              <p className="text-xs text-[#87918C]">Grounded in Max’s data</p>
            </div>
          </div>
          <div className="mt-5 rounded-2xl bg-[#F5F3FB] p-4">
            <p className="text-sm leading-6 text-[#545065]">
              {section === 'health'
                ? 'Max’s routine wellness review is coming up in 18 days. His recorded vaccines are current.'
                : section === 'tracking'
                ? 'The tracker plan and network service are active. The most recent GPS observation is 2 minutes old.'
                : section === 'care'
                ? 'Four of six care tasks are complete today. Dinner and the evening walk remain.'
                : 'Everything here stays connected to the same Pet profile, with source ownership preserved.'}
            </p>
          </div>
          <button className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#5C4EA0]">
            Ask about this <ArrowRight className="h-4 w-4" />
          </button>
        </Surface>
      </div>
    </>
  );
};

export const PetOSExperience: React.FC<PetOSExperienceProps> = ({ onOpenLab }) => {
  const [section, setSection] = useState<ProductSection>('home');
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeNav = useMemo(() => navItems.find((item) => item.id === section), [section]);

  const selectSection = (next: ProductSection) => {
    setSection(next);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F6F7F4] text-[#1B2A23]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-[#E5E8E3] bg-[#FBFCFA] lg:flex lg:flex-col">
        <div className="flex h-[82px] items-center gap-3 px-6">
          <div className="grid h-10 w-10 place-items-center rounded-[15px] bg-[#1F5F46] text-white shadow-[0_8px_20px_rgba(31,95,70,0.2)]">
            <PawPrint className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[17px] font-semibold tracking-[-0.03em] text-[#18271F]">Pet OS</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9AA39E]">Life with pets, in sync</p>
          </div>
        </div>

        <div className="px-4">
          <button className="flex w-full items-center gap-3 rounded-[18px] border border-[#E5E9E5] bg-white p-3 text-left shadow-[0_8px_24px_rgba(36,53,44,0.05)]">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#E6F0EA] text-[#2F6B50]"><Dog className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Max</p>
              <p className="truncate text-[11px] text-[#8A938E]">Golden Retriever</p>
            </div>
            <ChevronDown className="h-4 w-4 text-[#9AA39E]" />
          </button>
        </div>

        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto px-4 pb-6">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                onClick={() => selectSection(id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition ${active ? 'bg-[#E7F0EA] text-[#22543E]' : 'text-[#65716B] hover:bg-[#F0F3F0] hover:text-[#314038]'}`}
              >
                <Icon className={`h-[18px] w-[18px] ${active ? 'text-[#2F6B50]' : 'text-[#8D9792]'}`} />
                {label}
                {id === 'care' && <span className="ml-auto rounded-full bg-[#E3A66E] px-2 py-0.5 text-[10px] font-bold text-white">2</span>}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#ECEEEC] p-4">
          <button onClick={onOpenLab} className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-[#68736D] transition hover:bg-[#F0F3F0]">
            <FlaskConical className="h-[18px] w-[18px] text-[#8D9792]" />
            Build lab
          </button>
          <button className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-[#68736D] transition hover:bg-[#F0F3F0]">
            <Settings className="h-[18px] w-[18px] text-[#8D9792]" />
            Settings
          </button>
          <div className="mt-4 flex items-center gap-3 rounded-2xl px-2 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#E7DDD2] text-xs font-bold text-[#765A48]">SN</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Steve Nyaga</p>
              <p className="truncate text-[11px] text-[#919A95]">Pet parent</p>
            </div>
            <MoreHorizontal className="h-4 w-4 text-[#9AA39E]" />
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-[#13271E]/30 backdrop-blur-sm" />
          <div className="relative h-full w-[86%] max-w-[330px] bg-[#FBFCFA] p-4 shadow-2xl">
            <div className="flex items-center justify-between px-2 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-[14px] bg-[#1F5F46] text-white"><PawPrint className="h-5 w-5" /></div>
                <span className="font-semibold">Pet OS</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-[#65716B]"><X className="h-5 w-5" /></button>
            </div>
            <nav className="mt-4 space-y-1">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => selectSection(id)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${section === id ? 'bg-[#E7F0EA] text-[#22543E]' : 'text-[#65716B]'}`}>
                  <Icon className="h-[18px] w-[18px]" />
                  {label}
                </button>
              ))}
            </nav>
            <button onClick={onOpenLab} className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-[#E5E8E3] px-4 py-3 text-sm font-medium text-[#65716B]">
              <FlaskConical className="h-[18px] w-[18px]" /> Build lab
            </button>
          </div>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-[#E6E9E5]/80 bg-[#F6F7F4]/88 backdrop-blur-xl">
          <div className="flex h-[74px] items-center gap-3 px-4 sm:px-6 lg:px-8 xl:px-10">
            <button onClick={() => setMobileOpen(true)} className="rounded-xl p-2 text-[#4C5A53] lg:hidden"><Menu className="h-5 w-5" /></button>

            <div className="hidden min-w-0 items-center gap-2 text-sm text-[#8A938E] sm:flex">
              <span>Pet OS</span>
              <ChevronRight className="h-4 w-4" />
              <span className="font-semibold text-[#425149]">{activeNav?.label}</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button className="hidden h-10 items-center gap-2 rounded-2xl border border-[#E1E5E1] bg-white px-3.5 text-sm text-[#858F8A] shadow-sm sm:flex md:w-64">
                <Search className="h-4 w-4" />
                <span className="truncate">Search Max, records, services…</span>
                <span className="ml-auto rounded-md border border-[#E7EAE7] px-1.5 py-0.5 text-[10px] text-[#A0A8A4]">⌘K</span>
              </button>
              <button className="relative grid h-10 w-10 place-items-center rounded-2xl border border-[#E1E5E1] bg-white text-[#5F6C65] shadow-sm">
                <Bell className="h-[18px] w-[18px]" />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#E3795A] ring-2 ring-white" />
              </button>
              <button className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#1F5F46] px-3.5 text-sm font-semibold text-white shadow-sm">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Quick add</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1480px] px-4 py-7 sm:px-6 lg:px-8 xl:px-10 xl:py-9">
          {section === 'home' ? <HomeView /> : <FeatureView section={section} />}
        </main>

        <footer className="mx-auto max-w-[1480px] px-4 pb-8 pt-2 text-xs text-[#9AA39E] sm:px-6 lg:px-8 xl:px-10">
          <div className="flex flex-col gap-2 border-t border-[#E4E8E4] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <span>Pet OS · One profile across the whole life of your pet.</span>
            <span>Privacy · Safety · Provenance</span>
          </div>
        </footer>
      </div>
    </div>
  );
};
