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

  useEffect(() => {
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("player-assigned", (data: { playerNumber: number; roomId: string }) => {
      setPlayerNumber(data.playerNumber);
    });

    socket.on("room-update", (data: { playersCount: number; maxPlayers: number }) => {
      setPlayersCount(data.playersCount);
    });

    socket.on("room-closed", (data: { message: string; countdown: number }) => {
      setCountdown(data.countdown);
    });

    socket.on("game-start", () => {
      setCountdown(null);
      setPlayersCount(0);
      setGameStarted(true);
    });

    socket.on("your-hand", (data: { pieces: DominoPiece[] }) => {
      setMyHand(data.pieces);
    });

    socket.on("turn-update", (data: { currentTurn: number, tableEnds: number[], tablePieces: any[] }) => {
      setCurrentTurn(data.currentTurn);
      setTableEnds(data.tableEnds);
      setTablePieces(data.tablePieces);
      setPassedPlayer(null); // Limpa o estado de pass ao trocar o turno
    });

    socket.on("player-passed", (data: { playerNumber: number }) => {
      setPassedPlayer(data.playerNumber);
    });

    socket.on("game-over", (data: { winner?: number; tie?: boolean }) => {
      setGameOverInfo(data);
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
      socket.off("player-passed");
      socket.off("game-over");
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
