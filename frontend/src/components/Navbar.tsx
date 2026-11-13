'use client';

import Link from 'next/link';

interface NavbarProps {
  username?: string | null;
  onLogout?: () => void;
}

export function Navbar({ username, onLogout }: NavbarProps) {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg group-hover:scale-105 transition-transform">
            ⚡
          </span>
          <span className="font-semibold text-lg tracking-tight text-white">
            Ping<span className="text-emerald-400">Pulse</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {username ? (
            <>
              <div className="text-sm text-zinc-400 hidden sm:block">
                Xin chào, <span className="font-medium text-zinc-200">{username}</span>
              </div>
              <button
                onClick={onLogout}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 transition-colors"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white transition-colors"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold transition-colors shadow-sm shadow-emerald-500/20"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
