import { useEffect, useState } from "react";
import { socket } from "./socket";
import Game from "./GameDeliverParts";

interface DominoPiece {
  id: string;
  sideA: number;
  sideB: number;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [playerNumber, setPlayerNumber] = useState<number | null>(null);
  const [playersCount, setPlayersCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [myHand, setMyHand] = useState<DominoPiece[]>([]);
  const [currentTurn, setCurrentTurn] = useState<number | null>(null);
  const [tableEnds, setTableEnds] = useState<number[]>([]);
  const [tablePieces, setTablePieces] = useState<any[]>([]);
  const [passedPlayer, setPassedPlayer] = useState<number | null>(null);
  const [gameOverInfo, setGameOverInfo] = useState<{ winner?: number; tie?: boolean } | null>(null);
  const [abortMessage, setAbortMessage] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [playerHandCounts, setPlayerHandCounts] = useState<Record<number, number>>({});

  const normalizePlayerHandCounts = (counts?: Record<number, number>) =>
    Object.entries(counts ?? {}).reduce<Record<number, number>>((acc, [key, value]) => {
      const parsedKey = Number(key);
      if (!Number.isNaN(parsedKey)) {
        acc[parsedKey] = Number(value);
      }
      return acc;
    }, {});

  // Reseta todo o estado de jogo (volta para a tela de lobby)
  const resetGameState = () => {
    setGameStarted(false);
    setMyHand([]);
    setCurrentTurn(null);
    setTableEnds([]);
    setTablePieces([]);
    setPassedPlayer(null);
    setGameOverInfo(null);
    setCountdown(null);
    setAbortMessage(null);
    setPlayerHandCounts({});
  };

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("player-assigned", (data: { playerNumber: number; roomId: string }) => {
      setJoinError(null);
      setPlayerNumber(data.playerNumber);
    });

    // O back-end agora inclui o campo disconnectedPlayer opcional
    socket.on("room-update", (data: { playersCount: number; maxPlayers: number; disconnectedPlayer?: number }) => {
      setPlayersCount(data.playersCount);
    });

    socket.on("room-closed", (data: { message: string; countdown: number }) => {
      setCountdown(data.countdown);
    });

    socket.on("game-start", () => {
      setCountdown(null);
      setPlayersCount(0);
      setAbortMessage(null);
      setGameStarted(true);
    });

    socket.on("your-hand", (data: { pieces: DominoPiece[] }) => {
      setMyHand(data.pieces);
    });

    socket.on("turn-update", (data: { currentTurn: number | null; tableEnds: number[]; tablePieces: any[]; playerHandCounts?: Record<number, number> }) => {
      setCurrentTurn(data.currentTurn);
      setTableEnds(data.tableEnds);
      setTablePieces(data.tablePieces);
      setPlayerHandCounts(normalizePlayerHandCounts(data.playerHandCounts));
      setPassedPlayer(null); // Limpa o estado de pass ao trocar o turno
    });

    socket.on("player-hand-counts", (data: { playerHandCounts?: Record<number, number> }) => {
      setPlayerHandCounts(normalizePlayerHandCounts(data.playerHandCounts));
    });

    socket.on("player-passed", (data: { playerNumber: number }) => {
      setPassedPlayer(data.playerNumber);
    });

    socket.on("game-over", (data: { winner?: number; tie?: boolean }) => {
      setGameOverInfo(data);
    });

    // NOVO: Partida abortada por desconexão de jogador
    socket.on("game-aborted", (data: { message: string; disconnectedPlayer?: number }) => {
      resetGameState();
      setAbortMessage(data.message);
    });

    // NOVO: Erro ao tentar entrar em sala (ex: sala cheia ou socket duplicado)
    socket.on("join-error", (data: { message: string }) => {
      setJoinError(data.message);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("player-assigned");
      socket.off("room-update");
      socket.off("room-closed");
      socket.off("game-start");
      socket.off("your-hand");
      socket.off("turn-update");
      socket.off("player-hand-counts");
      socket.off("player-passed");
      socket.off("game-over");
      socket.off("game-aborted");
      socket.off("join-error");
    };
  }, []);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const handleJoin = () => {
    setJoinError(null);
    socket.emit("join-room");
  };

  const handleExit = () => {
    window.location.reload();
  };

  if (gameStarted) {
    return (
      <>
        {gameOverInfo && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>Fim de Jogo!</h1>
            {gameOverInfo.tie ? (
              <h2 style={{ color: 'orange', fontSize: '2rem' }}>Empate! O jogo travou.</h2>
            ) : (
              <h2 style={{ color: 'lime', fontSize: '2rem' }}>O Jogador {gameOverInfo.winner} Venceu!</h2>
            )}
            <button onClick={handleExit} style={{ marginTop: '30px', padding: '15px 30px', fontSize: '1.5rem', cursor: 'pointer', borderRadius: '10px', backgroundColor: '#0070ff', color: 'white', border: 'none' }}>Sair</button>
          </div>
        )}
        <Game 
          myHand={myHand} 
          myNumber={playerNumber}
          currentTurn={currentTurn}
          tableEnds={tableEnds}
          tablePieces={tablePieces}
          passedPlayer={passedPlayer}
          playerHandCounts={playerHandCounts}
          socket={socket}
        />
      </>
    );
  }

  return (
    <div id="rooms-screen">
      <h1>Domino online</h1>
      <h2 id="status-server">
        Status do server: {connected ? "conectado ✅" : "desconectado ❌"}
      </h2>

      {/* Mensagem de partida abortada (jogador desconectou) */}
      {abortMessage && (
        <p id="abort-message" style={{ color: 'black', fontWeight: 'bold' }}>
          ⚠️ {abortMessage}
        </p>
      )}

      {/* Erro ao tentar entrar na sala */}
      {joinError && (
        <p id="join-error" style={{ color: 'black', fontWeight: 'bold' }}>
          ❌ {joinError}
        </p>
      )}

      {playerNumber === null ? (
        <button onClick={handleJoin} id="btn-join">
          Entrar na sala
        </button>
      ) : (
        <p className="you-player-number">Você é o jogador {playerNumber}</p>
      )}
      <p className="you-player-number">Jogadores na sala: {playersCount}/4</p>
      {countdown !== null && countdown > 0 && (
        <p>🔒 Sala fechada. Jogo começa em {countdown}...</p>
      )}
    </div>
  );
}

export default App;
