import Link from "next/link";
import { useMemo } from "react";
import { HiCalendar } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";

import { api } from "~/utils/api";

// Quotes rotated by day of year
const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Progress, not perfection.", author: "Unknown" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "You are never too old to set another goal or to dream a new dream.", author: "C.S. Lewis" },
  { text: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { text: "Dream big and dare to fail.", author: "Norman Vaughan" },
  { text: "It's not about having time. It's about making time.", author: "Unknown" },
  { text: "Every accomplishment starts with the decision to try.", author: "John F. Kennedy" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Great things never come from comfort zones.", author: "Unknown" },
  { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
  { text: "You don't need to see the whole staircase, just take the first step.", author: "Martin Luther King Jr." },
  { text: "Hardships often prepare ordinary people for an extraordinary destiny.", author: "C.S. Lewis" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
  { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "If you're going through hell, keep going.", author: "Winston Churchill" },
  { text: "Everything you've ever wanted is on the other side of fear.", author: "George Addair" },
  { text: "Be so good they can't ignore you.", author: "Steve Martin" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
  { text: "Don't limit your challenges. Challenge your limits.", author: "Unknown" },
  { text: "Work hard in silence, let your success be the noise.", author: "Frank Ocean" },
  { text: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
  { text: "Perseverance is not a long race; it is many short races one after the other.", author: "Walter Elliot" },
  { text: "What we fear doing most is usually what we most need to do.", author: "Tim Ferriss" },
  { text: "Life begins at the end of your comfort zone.", author: "Neale Donald Walsch" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Unknown" },
  { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
];

interface Card {
  publicId: string;
  title: string;
  dueDate: Date | null;
}

interface WeeklyOverviewBarProps {
  cards: Card[];
}

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

function formatDueDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function WeeklyOverviewBar({ cards }: WeeklyOverviewBarProps) {
  const { data: energyData } = api.productivity.getEnergyCheckin.useQuery();
  const { data: questsData } = api.productivity.getDailyQuests.useQuery();
  const { data: winsData } = api.productivity.getTodayWins.useQuery();

  const streak = energyData?.streak ?? 0;
  const energyLevel = energyData?.today?.energyLevel ?? 0;
  const completedQuests = (questsData?.quests ?? []).filter(
    (q) => q.completed,
  ).length;
  const totalQuests = (questsData?.quests ?? []).length;
  const winsToday = (winsData?.wins ?? []).length;

  const dayOfYear = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, []);

  const dayOfWeek = new Date().getDay(); // 0=Sun ... 6=Sat

  // Deadline cards this week
  const deadlineCards = useMemo(() => {
    const { start, end } = getWeekRange();
    return cards
      .filter((card) => {
        if (!card.dueDate) return false;
        const d = new Date(card.dueDate);
        return d >= start && d <= end;
      })
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [cards]);

  // Motivating stat rotates per day of week, draws from real data
  const stat = useMemo(() => {
    switch (dayOfWeek) {
      case 1: // Monday
        return streak > 0
          ? { icon: "🔥", text: `${streak}-day streak — start the week strong!` }
          : { icon: "🌅", text: "Fresh week, fresh energy!" };
      case 2: // Tuesday
        return totalQuests > 0
          ? {
              icon: "✅",
              text: `${completedQuests}/${totalQuests} quests done — building momentum`,
            }
          : { icon: "⚡", text: "Set your quests and build momentum!" };
      case 3: // Wednesday
        return winsToday > 0
          ? {
              icon: "🏆",
              text: `${winsToday} win${winsToday === 1 ? "" : "s"} today — celebrate mid-week!`,
            }
          : { icon: "🏔️", text: "Hump day — you're halfway there!" };
      case 4: // Thursday
        return {
          icon: "🚀",
          text:
            deadlineCards.length > 0
              ? `${deadlineCards.length} task${deadlineCards.length === 1 ? "" : "s"} this week — you've got this!`
              : "Keep the energy going!",
        };
      case 5: // Friday
        return energyLevel > 0
          ? {
              icon: "🎉",
              text: `Energy level ${energyLevel}/5 — finish the week strong!`,
            }
          : { icon: "🎉", text: "Friday! Wrap up and celebrate." };
      case 6: // Saturday
        return { icon: "🌿", text: "Weekend mode — recharge and reflect." };
      case 0: // Sunday
        return { icon: "🎯", text: "Rest up, plan ahead for a great week." };
      default:
        return { icon: "✨", text: "Make today count!" };
    }
  }, [dayOfWeek, streak, completedQuests, totalQuests, winsToday, energyLevel, deadlineCards.length]);

  // Quote shows roughly every other day
  const quote = useMemo(() => {
    // Use a varied pattern: show on days 1,3,5,8,10,12... roughly 50%
    if (dayOfYear % 3 === 0) return null;
    return QUOTES[dayOfYear % QUOTES.length];
  }, [dayOfYear]);

  return (
    <section className="mb-6 rounded-lg border border-light-300 bg-gradient-to-r from-light-50 to-light-100/50 p-4 dark:border-dark-300 dark:from-dark-50 dark:to-dark-100/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Left: Stat + Quote */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{stat.icon}</span>
            <span className="text-sm font-medium text-neutral-900 dark:text-dark-1000">
              {stat.text}
            </span>
          </div>
          {quote && (
            <p className="mt-2 pl-7 text-xs italic text-light-900 dark:text-dark-900">
              &ldquo;{quote.text}&rdquo; &mdash; {quote.author}
            </p>
          )}
        </div>

        {/* Right: Deadline cards this week */}
        {deadlineCards.length > 0 && (
          <div className="flex-shrink-0 sm:max-w-[16rem]">
            <div className="mb-1.5 flex items-center gap-1.5">
              <HiCalendar className="h-3 w-3 text-light-900 dark:text-dark-900" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-light-900 dark:text-dark-900">
                This week
              </span>
            </div>
            <div className="space-y-1">
              {deadlineCards.slice(0, 3).map((card) => {
                const isOverdue =
                  card.dueDate && new Date(card.dueDate) < new Date();
                return (
                  <Link
                    key={card.publicId}
                    href={`/cards/${card.publicId}`}
                    className="group flex items-center gap-2 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-light-200 dark:hover:bg-dark-200"
                  >
                    <span className="min-w-0 truncate text-neutral-900 dark:text-dark-1000">
                      {card.title}
                    </span>
                    <span
                      className={twMerge(
                        "flex-shrink-0",
                        isOverdue
                          ? "text-red-600 dark:text-red-400"
                          : "text-light-900 dark:text-dark-900",
                      )}
                    >
                      {formatDueDate(card.dueDate!)}
                    </span>
                  </Link>
                );
              })}
              {deadlineCards.length > 3 && (
                <span className="block px-1.5 text-[11px] text-light-900 dark:text-dark-900">
                  +{deadlineCards.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
