"use client";

import { Dices, DoorOpen, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { DiceAnimation } from "../components/DiceAnimation";
import { DiceRoller } from "../components/DiceRoller";
import { FeedbackButton } from "../components/FeedbackButton";
import { HostControls } from "../components/HostControls";
import { LobbyHeader } from "../components/LobbyHeader";
import { PlayerList } from "../components/PlayerList";
import { RollLog } from "../components/RollLog";
import { SiteFooter } from "../components/SiteFooter";
import type { DiceTerm, Roll, RollVisibility } from "../lib/dice";
import { shouldHandleLobbyClosedEvent } from "../lib/lobby-events";
import type { LobbyState, Player } from "../lib/lobby";
import { normalizeLobbyCode } from "../lib/lobby";
import { getSocketTransports } from "../lib/socket";

type PendingRoll = {
  code: string;
  id: string;
  playerName: string;
  diceColor: string;
  expression: string;
  visibility: RollVisibility;
};

type Ack<T> = { ok: true; data: T } | { ok: false; error: string; retryable?: boolean };

type PlayerSessionResponse = { state: LobbyState; player: Player; sessionToken: string };

type Session = {
  playerId: string;
  sessionToken: string;
  username: string;
  diceColor: string;
  lobbyCode: string;
};

const SESSION_KEY = "dicehall-session";
const DEFAULT_COLOR = "#d79b4a";
const SESSION_RENEWAL_WARNING_MS = 10 * 60 * 1000;

function getInitialSession(): Session {
  if (typeof window === "undefined") {
    return {
      playerId: "",
      sessionToken: "",
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
        playerId: parsed.playerId || "",
        sessionToken: parsed.sessionToken || "",
        username: parsed.username || "",
        diceColor: parsed.diceColor || DEFAULT_COLOR,
        lobbyCode: parsed.lobbyCode || ""
      };
    } catch {
      window.sessionStorage.removeItem(SESSION_KEY);
    }
  }

  return {
    playerId: "",
    sessionToken: "",
    username: "",
    diceColor: DEFAULT_COLOR,
    lobbyCode: ""
  };
}

function saveSession(session: Session) {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function formatTimeLeft(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
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
  const [isJoined, setIsJoined] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const socketRef = useRef<Socket | null>(null);
  const sessionRef = useRef(session);
  const lobbyRef = useRef<LobbyState | null>(null);
  const joinedRef = useRef(false);
  const generationRef = useRef(0);

  const updateSession = useCallback((patch: Partial<Session>) => {
    const next = { ...sessionRef.current, ...patch };
    sessionRef.current = next;
    saveSession(next);
    setSession(next);
  }, []);

  const setJoined = useCallback((value: boolean) => {
    joinedRef.current = value;
    setIsJoined(value);
  }, []);

  const applyLobbyState = useCallback((nextLobby: LobbyState | null) => {
    lobbyRef.current = nextLobby;
    setNow(Date.now());
    setLobby(nextLobby);
  }, []);

  const acceptSession = useCallback((data: PlayerSessionResponse) => {
    updateSession({
      playerId: data.player.id,
      sessionToken: data.sessionToken,
      username: data.player.username,
      lobbyCode: data.state.code,
      diceColor: data.player.diceColor
    });
    applyLobbyState(data.state);
    setJoined(true);
  }, [updateSession, applyLobbyState, setJoined]);

  const resetLobby = useCallback(() => {
    generationRef.current += 1;
    setJoined(false);
    applyLobbyState(null);
    setPendingRolls([]);
    setIsBusy(false);
    updateSession({ lobbyCode: "" });
  }, [setJoined, applyLobbyState, updateSession]);

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      transports: getSocketTransports()
    });
    socketRef.current = socket;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function resumeLobby(generation: number) {
      if (generation !== generationRef.current || !socket.connected || !sessionRef.current.lobbyCode) {
        return;
      }

      const saved = sessionRef.current;
      socket.timeout(5000).emit("lobby:join", {
        code: saved.lobbyCode,
        username: saved.username,
        playerId: saved.playerId,
        sessionToken: saved.sessionToken,
        resumeOnly: true
      }, (timeout: Error | null, response?: Ack<PlayerSessionResponse>) => {
        if (generation !== generationRef.current || !socket.connected) {
          return;
        }

        if (timeout || !response || (!response.ok && response.retryable)) {
          setError("Could not restore the lobby connection. Retrying…");
          retryTimer = setTimeout(() => resumeLobby(generation), 5000);
          return;
        }

        if (!response.ok) {
          resetLobby();
          setError(response.error);
          return;
        }

        acceptSession(response.data);
        setIsBusy(false);
        setError("");
      });
    }

    socket.on("connect", () => {
      const generation = ++generationRef.current;
      clearTimeout(retryTimer);
      setJoined(false);
      setIsBusy(Boolean(sessionRef.current.lobbyCode));
      setError(sessionRef.current.lobbyCode ? "Restoring your lobby connection…" : "");
      resumeLobby(generation);
    });

    socket.on("disconnect", () => {
      generationRef.current += 1;
      clearTimeout(retryTimer);
      setJoined(false);
      setIsBusy(false);
      setPendingRolls([]);
      if (sessionRef.current.lobbyCode) {
        setError("Connection lost. Reconnecting to your lobby…");
      }
    });

    socket.on("lobby:state", (state: LobbyState) => {
      if (joinedRef.current && state.code === sessionRef.current.lobbyCode) {
        applyLobbyState(state);
      }
    });

    socket.on("roll:start", (roll: PendingRoll) => {
      if (joinedRef.current && roll.code === sessionRef.current.lobbyCode) {
        setPendingRolls((current) => [roll, ...current].slice(0, 3));
      }
    });

    socket.on("roll:committed", (roll: Roll & { code: string }) => {
      if (joinedRef.current && roll.code === sessionRef.current.lobbyCode) {
        setPendingRolls((current) => current.filter((candidate) => candidate.id !== roll.id));
      }
    });

    socket.on("rolls:cleared", ({ code }: { code: string }) => {
      if (joinedRef.current && code === sessionRef.current.lobbyCode) {
        setPendingRolls([]);
      }
    });

    socket.on("player:removed", ({ code, playerId }: { code: string; playerId: string }) => {
      if (code === sessionRef.current.lobbyCode && playerId === sessionRef.current.playerId) {
        resetLobby();
        setError("You were removed from the lobby by the DM.");
      }
    });

    socket.on("lobby:closed", ({ code, reason }: { code?: string; reason: string }) => {
      if (!shouldHandleLobbyClosedEvent(lobbyRef.current?.code ?? sessionRef.current.lobbyCode, code)) {
        return;
      }

      setError(reason === "expired" ? "The lobby session expired." : "The lobby was closed.");
      resetLobby();
    });

    socket.on("connect_error", (connectionError) => {
      setError(`Could not connect to the realtime server. ${connectionError.message}`);
    });

    return () => {
      clearTimeout(retryTimer);
      generationRef.current += 1;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [acceptSession, resetLobby, applyLobbyState, setJoined]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const currentPlayer = useMemo(
    () => lobby?.players.find((player) => player.id === session.playerId),
    [lobby?.players, session.playerId]
  );
  const isHost = Boolean(lobby && lobby.hostId === session.playerId);
  const sessionTimeLeft = lobby ? lobby.expiresAt - now : 0;
  const sessionTimeLeftLabel = formatTimeLeft(sessionTimeLeft);
  const renewalTimeLeftLabel =
    isHost && sessionTimeLeft <= SESSION_RENEWAL_WARNING_MS ? formatTimeLeft(sessionTimeLeft) : null;

  function handleAck<T>(response: Ack<T> | undefined, generation: number) {
    if (generation !== generationRef.current || !socketRef.current?.connected) {
      return null;
    }
    if (!response) {
      setError("No response from the server. Please try again.");
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
    if (!socketRef.current?.connected) {
      setError("Connect to the server before creating a lobby.");
      return;
    }
    const username = hostName.trim();

    if (!username) {
      setError("Enter a DM name before creating a lobby.");
      return;
    }

    setIsBusy(true);
    setError("");
    const generation = ++generationRef.current;
    socketRef.current.timeout(5000).emit(
      "lobby:create",
      {
        username
      },
      (timeout: Error | null, response?: Ack<PlayerSessionResponse>) => {
        if (generation !== generationRef.current) return;
        setIsBusy(false);
        const data = handleAck(timeout ? undefined : response, generation);

        if (data) {
          acceptSession(data);
        }
      }
    );
  }

  async function joinLobby() {
    if (!socketRef.current?.connected) {
      setError("Connect to the server before joining a lobby.");
      return;
    }
    const username = joinName.trim();
    const code = normalizeLobbyCode(joinCode);

    if (!username) {
      setError("Enter a username before joining.");
      return;
    }

    setIsBusy(true);
    setError("");
    const generation = ++generationRef.current;
    socketRef.current.timeout(5000).emit(
      "lobby:join",
      {
        code,
        username,
        playerId: session.playerId,
        sessionToken: session.sessionToken
      },
      (timeout: Error | null, response?: Ack<PlayerSessionResponse>) => {
        if (generation !== generationRef.current) return;
        setIsBusy(false);
        const data = handleAck(timeout ? undefined : response, generation);

        if (data) {
          acceptSession(data);
        }
      }
    );
  }

  const visibleRolls = useMemo(() => {
    const privateRolls = lobby?.privateRolls ?? [];
    return [...(lobby?.rolls ?? []), ...privateRolls].sort((first, second) => second.timestamp - first.timestamp);
  }, [lobby?.privateRolls, lobby?.rolls]);

  function rollDice(request: { terms: DiceTerm[]; modifier: number; visibility: RollVisibility }) {
    if (!lobby || !joinedRef.current || !socketRef.current?.connected) {
      return;
    }

    const generation = generationRef.current;
    socketRef.current.emit(
      "roll:start",
      {
        code: lobby.code,
        ...request
      },
      (response: Ack<{ rollId: string }>) => {
        handleAck(response, generation);
      }
    );
  }

  function clearLog() {
    if (!lobby || !joinedRef.current || !socketRef.current?.connected) {
      return;
    }

    const generation = generationRef.current;
    socketRef.current.emit(
      "host:clearLog",
      {
        code: lobby.code
      },
      (response: Ack<LobbyState>) => {
        handleAck(response, generation);
      }
    );
  }

  function removePlayer(playerId: string) {
    if (!lobby || !joinedRef.current || !socketRef.current?.connected) {
      return;
    }

    const generation = generationRef.current;
    socketRef.current.emit(
      "host:removePlayer",
      {
        code: lobby.code,
        playerId
      },
      (response: Ack<LobbyState>) => {
        handleAck(response, generation);
      }
    );
  }

  function renewSession() {
    if (!lobby || !joinedRef.current || !socketRef.current?.connected) {
      return;
    }

    const generation = generationRef.current;
    socketRef.current.emit(
      "host:renewSession",
      {
        code: lobby.code
      },
      (response: Ack<LobbyState>) => {
        const data = handleAck(response, generation);

        if (data) {
          applyLobbyState(data);
        }
      }
    );
  }

  function leaveLobby() {
    resetLobby();
    setError("");
    const generation = generationRef.current;
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.timeout(5000).emit("lobby:leave", {}, (timeout: Error | null) => {
        if (timeout && generation === generationRef.current && socket.connected) {
          socket.disconnect().connect();
        }
      });
    }
  }

  if (lobby && currentPlayer) {
    return (
      <>
        <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <LobbyHeader
                code={lobby.code}
                username={currentPlayer.username}
                isHost={isHost}
                onLeave={leaveLobby}
              />
              <FeedbackButton pageContext="lobby" />
            </div>

            {error ? (
              <div className="rounded-lg border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm font-semibold text-crimson">
                {error}
              </div>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
              <div className="grid gap-5 xl:grid-cols-[24rem_1fr]">
                <DiceRoller
                  disabled={!isJoined}
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
                  disabled={!isJoined}
                  players={lobby.players}
                  currentPlayerId={session.playerId}
                  isHost={isHost}
                  onRemovePlayer={removePlayer}
                />
                <HostControls
                  disabled={!isJoined}
                  canUse={isHost}
                  onClearLog={clearLog}
                  onRenewSession={renewSession}
                  sessionTimeLeftLabel={sessionTimeLeftLabel}
                  renewalTimeLeftLabel={renewalTimeLeftLabel}
                />
              </aside>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
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
            <div className="mt-6">
              <FeedbackButton pageContext="home" />
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
      <SiteFooter />
    </>
  );
}
