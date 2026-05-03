"use client";

import { Dices, DoorOpen, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { DiceAnimation } from "../components/DiceAnimation";
import { DiceRoller } from "../components/DiceRoller";
import { HostControls } from "../components/HostControls";
import { LobbyHeader } from "../components/LobbyHeader";
import { PlayerList } from "../components/PlayerList";
import { RollLog } from "../components/RollLog";
import type { DiceTerm, Roll, RollVisibility } from "../lib/dice";
import type { LobbyState, Player } from "../lib/lobby";
import { normalizeLobbyCode } from "../lib/lobby";

type PendingRoll = {
  id: string;
  playerName: string;
  diceColor: string;
  expression: string;
  visibility: RollVisibility;
};

type Ack<T> = { ok: true; data: T } | { ok: false; error: string };

type Session = {
  playerId: string;
  username: string;
  diceColor: string;
  lobbyCode: string;
};

const SESSION_KEY = "dicehall-session";
const DEFAULT_COLOR = "#d79b4a";

function getInitialSession(): Session {
  if (typeof window === "undefined") {
    return {
      playerId: "",
      username: "",
      diceColor: DEFAULT_COLOR,
      lobbyCode: ""
    };
  }

  const stored = window.sessionStorage.getItem(SESSION_KEY);

  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<Session>;
      return {
        playerId: parsed.playerId || crypto.randomUUID(),
        username: parsed.username || "",
        diceColor: parsed.diceColor || DEFAULT_COLOR,
        lobbyCode: parsed.lobbyCode || ""
      };
    } catch {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  }

  return {
    playerId: crypto.randomUUID(),
    username: "",
    diceColor: DEFAULT_COLOR,
    lobbyCode: ""
  };
}

function saveSession(session: Session) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export default function Home() {
  const [session, setSession] = useState<Session>(() => getInitialSession());
  const [hostName, setHostName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [pendingRolls, setPendingRolls] = useState<PendingRoll[]>([]);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("lobby:state", (state: LobbyState) => {
      setLobby(state);
    });

    socket.on("roll:start", (roll: PendingRoll) => {
      setPendingRolls((current) => [roll, ...current].slice(0, 3));
    });

    socket.on("roll:committed", (roll: Roll) => {
      setPendingRolls((current) => current.filter((candidate) => candidate.id !== roll.id));
    });

    socket.on("player:removed", ({ playerId }: { playerId: string }) => {
      if (playerId === session.playerId) {
        setError("You were removed from the lobby by the DM.");
        setLobby(null);
        setSession((current) => {
          const next = { ...current, lobbyCode: "" };
          saveSession(next);
          return next;
        });
      }
    });

    socket.on("connect_error", () => {
      setError("Could not connect to the realtime server.");
    });

    return () => {
      socket.disconnect();
    };
  }, [session.playerId]);

  const currentPlayer = useMemo(
    () => lobby?.players.find((player) => player.id === session.playerId),
    [lobby?.players, session.playerId]
  );
  const isHost = Boolean(lobby && lobby.hostId === session.playerId);

  function updateSession(patch: Partial<Session>) {
    setSession((current) => {
      const next = { ...current, ...patch };
      saveSession(next);
      return next;
    });
  }

  function handleAck<T>(response: Ack<T> | undefined) {
    if (!response) {
      setError("No response from the server.");
      return null;
    }

    if (!response.ok) {
      setError(response.error);
      return null;
    }

    setError("");
    return response.data;
  }

  async function createLobby() {
    const username = hostName.trim();

    if (!username) {
      setError("Enter a DM name before creating a lobby.");
      return;
    }

    setIsBusy(true);
    socketRef.current?.emit(
      "lobby:create",
      {
        playerId: session.playerId,
        username
      },
      (response: Ack<LobbyState>) => {
        setIsBusy(false);
        const state = handleAck(response);

        if (state) {
          const player = state.players.find((candidate) => candidate.id === session.playerId);
          setLobby(state);
          updateSession({
            username,
            lobbyCode: state.code,
            diceColor: player?.diceColor ?? session.diceColor
          });
        }
      }
    );
  }

  async function joinLobby() {
    const username = joinName.trim();
    const code = normalizeLobbyCode(joinCode);

    if (!username) {
      setError("Enter a username before joining.");
      return;
    }

    setIsBusy(true);
    socketRef.current?.emit(
      "lobby:join",
      {
        code,
        playerId: session.playerId,
        username
      },
      (response: Ack<{ state: LobbyState; player: Player }>) => {
        setIsBusy(false);
        const data = handleAck(response);

        if (data) {
          setLobby(data.state);
          updateSession({
            username: data.player.username,
            lobbyCode: data.state.code,
            diceColor: data.player.diceColor
          });
        }
      }
    );
  }

  const visibleRolls = useMemo(() => {
    const privateRolls = lobby?.privateRolls ?? [];
    return [...(lobby?.rolls ?? []), ...privateRolls].sort((first, second) => second.timestamp - first.timestamp);
  }, [lobby?.privateRolls, lobby?.rolls]);

  function rollDice(request: { terms: DiceTerm[]; modifier: number; visibility: RollVisibility }) {
    if (!lobby) {
      return;
    }

    socketRef.current?.emit(
      "roll:start",
      {
        code: lobby.code,
        playerId: session.playerId,
        ...request
      },
      (response: Ack<{ rollId: string }>) => {
        handleAck(response);
      }
    );
  }

  function clearLog() {
    if (!lobby) {
      return;
    }

    socketRef.current?.emit(
      "host:clearLog",
      {
        code: lobby.code,
        playerId: session.playerId
      },
      (response: Ack<LobbyState>) => {
        handleAck(response);
      }
    );
  }

  function removePlayer(playerId: string) {
    if (!lobby) {
      return;
    }

    socketRef.current?.emit(
      "host:removePlayer",
      {
        code: lobby.code,
        hostId: session.playerId,
        playerId
      },
      (response: Ack<LobbyState>) => {
        handleAck(response);
      }
    );
  }

  function leaveLobby() {
    setLobby(null);
    setPendingRolls([]);
    updateSession({ lobbyCode: "" });
  }

  if (lobby && currentPlayer) {
    return (
      <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5">
          <LobbyHeader
            code={lobby.code}
            username={currentPlayer.username}
            isHost={isHost}
            onLeave={leaveLobby}
          />

          {error ? (
            <div className="rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm font-semibold text-crimson">
              {error}
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
            <div className="grid gap-5 xl:grid-cols-[24rem_1fr]">
              <DiceRoller
                diceColor={currentPlayer.diceColor}
                onRoll={rollDice}
              />
              <div className="grid gap-5">
                <DiceAnimation pendingRolls={pendingRolls} />
                <RollLog rolls={visibleRolls} />
              </div>
            </div>

            <aside className="grid content-start gap-5">
              <PlayerList
                players={lobby.players}
                currentPlayerId={session.playerId}
                isHost={isHost}
                onRemovePlayer={removePlayer}
              />
              <HostControls canUse={isHost} onClearLog={clearLog} />
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section>
          <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-brass/40 bg-brass/10 text-brass shadow-glow">
            <Dices size={26} />
          </div>
          <h1 className="max-w-2xl text-5xl font-black leading-tight text-stone-50 sm:text-6xl">
            Dicehall
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-stone-300">
            Real-time dice rolls for online campaigns. Create a lobby, share the code, and keep
            every player&apos;s rolls visible at the table.
          </p>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {["Shared lobbies", "Live roll log", "DM controls"].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                <p className="text-sm font-bold text-stone-200">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-ink-900/85 p-5 shadow-card">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles size={18} className="text-brass" />
            <h2 className="text-xl font-black text-stone-50">Start rolling</h2>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm font-semibold text-crimson">
              {error}
            </div>
          ) : null}

          <div className="grid gap-5">
            <div className="rounded-lg border border-brass/30 bg-brass/10 p-4">
              <h3 className="font-black text-stone-50">Create lobby</h3>
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-stone-300">DM name</span>
                <input
                  value={hostName}
                  onChange={(event) => setHostName(event.target.value)}
                  placeholder="Mira the DM"
                  className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-ink-950/60 px-3 text-stone-50 outline-none placeholder:text-stone-600 focus:border-brass focus:ring-2 focus:ring-brass/30"
                />
              </label>
              <button
                type="button"
                disabled={isBusy}
                onClick={createLobby}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brass px-4 text-sm font-black uppercase tracking-[0.14em] text-ink-950 transition hover:bg-[#e2ad66] focus:outline-none focus:ring-2 focus:ring-brass disabled:opacity-50"
              >
                <DoorOpen size={18} />
                Create Lobby
              </button>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
              <h3 className="font-black text-stone-50">Join lobby</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-[0.8fr_1.2fr]">
                <label className="block">
                  <span className="text-sm font-semibold text-stone-300">Lobby code</span>
                  <input
                    value={joinCode}
                    onChange={(event) => setJoinCode(normalizeLobbyCode(event.target.value))}
                    placeholder="ABC123"
                    maxLength={6}
                    className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-ink-950/60 px-3 font-black uppercase tracking-[0.18em] text-stone-50 outline-none placeholder:text-stone-600 focus:border-brass focus:ring-2 focus:ring-brass/30"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-stone-300">Username</span>
                  <input
                    value={joinName}
                    onChange={(event) => setJoinName(event.target.value)}
                    placeholder="Alice"
                    className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-ink-950/60 px-3 text-stone-50 outline-none placeholder:text-stone-600 focus:border-brass focus:ring-2 focus:ring-brass/30"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={isBusy}
                onClick={joinLobby}
                className="mt-4 h-11 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 text-sm font-black uppercase tracking-[0.14em] text-stone-100 transition hover:border-brass/60 focus:outline-none focus:ring-2 focus:ring-brass disabled:opacity-50"
              >
                Join Lobby
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
