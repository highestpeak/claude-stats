"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RefreshButton from "@/components/RefreshButton";

const TABS = [
  { href: "/",         label: "Overview"  },
  { href: "/tokens",   label: "Tokens"    },
  { href: "/projects", label: "Projects"  },
  { href: "/prompts",  label: "Prompts"   },
  { href: "/usage",    label: "Usage"     },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-border bg-card sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-12">
        <span className="text-textPrimary font-semibold text-sm mr-4">Claude Stats</span>
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3 py-1.5 text-sm rounded transition-colors ${
              pathname === tab.href
                ? "bg-bg text-textPrimary font-medium"
                : "text-textSecondary hover:text-textPrimary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
        <div className="ml-auto">
          <RefreshButton />
        </div>
      </div>
    </nav>
  );
}
