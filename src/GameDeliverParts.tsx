import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

const BASE = import.meta.env.BASE_URL;

interface DominoPiece {
  id: string;
  sideA: number;
  sideB: number;
}

export default function Game({
  myHand,
  myNumber,
  currentTurn,
  tableEnds,
  tablePieces,
  passedPlayer,
  playerHandCounts,
  socket
}: {
  myHand: DominoPiece[];
  myNumber: number | null;
  currentTurn: number | null;
  tableEnds: number[];
  tablePieces: any[];
  passedPlayer: number | null;
  playerHandCounts: Record<number, number>;
  socket: Socket;
}) {
  const isTurn = currentTurn === myNumber;
  const isPassing = passedPlayer === myNumber;
  const [pieceToPlaySide, setPieceToPlaySide] = useState<DominoPiece | null>(null);

  // Função que diz se uma peça pode ser jogada agora
  const isPlayable = (piece: DominoPiece) => {
    if (!isTurn) return false;
    
    // Primeira rodada do jogo: só pode jogar 1-1
    if (tableEnds.length === 0) {
      return piece.sideA === 1 && piece.sideB === 1;
    }

    // Se já tem peças na mesa, precisa combinar com alguma ponta
    return tableEnds.includes(piece.sideA) || tableEnds.includes(piece.sideB);
  };

  // Se é o seu turno, mas não há peças jogáveis, passa a vez automaticamente
  useEffect(() => {
    if (isTurn) {
      const hasPlayable = myHand.some(isPlayable);
      if (!hasPlayable) {
        // Envia o passe (com um pequeno delay para não ser instântaneo demais no front)
        setTimeout(() => {
          socket.emit("pass-turn");
        }, 500);
      }
    }
  }, [isTurn, myHand, tableEnds]);

  const handlePlayPiece = (piece: DominoPiece) => {
    if (!isPlayable(piece)) return;
    
    // Verifica se a peça encaixa nas DUAS pontas da mesa
    if (tableEnds.length === 2) {
      const fitsLeft = piece.sideA === tableEnds[0] || piece.sideB === tableEnds[0];
      const fitsRight = piece.sideA === tableEnds[1] || piece.sideB === tableEnds[1];
      
      if (fitsLeft && fitsRight) {
        // Encaixa nas duas, precisamos perguntar ao usuário
        setPieceToPlaySide(piece);
        return;
      }
    }
    
    // Se não encaixa nas duas, enviamos a única que encaixa
    let sideToPlay = undefined;
    if (tableEnds.length > 0) {
      if (tableEnds[0] === piece.sideA || tableEnds[0] === piece.sideB) {
        sideToPlay = tableEnds[0];
      } else {
        sideToPlay = tableEnds[1];
      }
    }

    socket.emit("play-piece", { pieceId: piece.id, sideToPlay });
  };

  const confirmPlaySide = (sideIndex: number) => {
    if (!pieceToPlaySide) return;
    const sideToPlay = tableEnds[sideIndex];
    socket.emit("play-piece", { pieceId: pieceToPlaySide.id, sideToPlay });
    setPieceToPlaySide(null);
  };

  return (
    <>
      <p className="description">
        Domino - {isTurn ? "SUA VEZ" : `Vez do Jogador ${currentTurn}`}
      </p>
      
      <div className="container">
        {pieceToPlaySide && (
          <div className="side-choice" style={{ position: 'absolute', zIndex: 10, background: 'rgba(255,255,255,0.9)', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
            <h3 className="side-choice-title">Escolha um lado:</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => confirmPlaySide(0)}>Lado Esquerdo ({tableEnds[0]})</button>
              <button onClick={() => confirmPlaySide(1)}>Lado Direito ({tableEnds[1]})</button>
            </div>
            <button style={{ backgroundColor: 'gray' }} onClick={() => setPieceToPlaySide(null)}>Cancelar</button>
          </div>
        )}

        <div
          id="player-main"
          className={`${isTurn ? "turn-player" : ""} ${isPassing ? "pass" : ""}`}
        > 
          {myHand.map((piece, i) => {
            const playable = isPlayable(piece);
            return (
              <span
                key={piece.id}
                className={`player-main-span ${playable ? "playable-piece" : ""}`}
                id={`player${myNumber}-number${i + 1}`}
                onClick={() => handlePlayPiece(piece)}
                style={{ cursor: playable ? "pointer" : "default" }}
              >
                <img
                  className="sideA"
                  src={`${BASE}parts/part-${piece.sideA}.jpg`}
                  alt={`part-${piece.id}`}
                />
                <img
                  className="sideB"
                  src={`${BASE}parts/part-${piece.sideB}.jpg`}
                  alt={`part-${piece.id}`}
                />
              </span>
            );
          })}
        </div>

        {/* Adversários (Escondidos) */}
        {(() => {
          // Calcula os números dos 3 adversários na ordem: direita, topo, esquerda
          const right = myNumber === 4 ? 1 : myNumber! + 1;
          const top   = myNumber! > 2 ? myNumber! - 2 : myNumber! + 2;
          const left  = myNumber === 1 ? 4 : myNumber! - 1;

          const renderOpponent = (playerNum: number, id: string, spanClass: string) => {
            const count = playerHandCounts[playerNum] ?? 7;
            const isTurnOp = currentTurn === playerNum;
            const isPaOp = passedPlayer === playerNum;
            return (
              <div
                id={id}
                className={`${isTurnOp ? "turn-player" : ""} ${isPaOp ? "pass" : ""}`}
                style={{ position: 'relative' }}
              >
                {Array.from({ length: count }).map((_, i) => (
                  <span key={i} className={spanClass}></span>
                ))}
                <span className="opponent-count-badge">{count}</span>
              </div>
            );
          };

          return (
            <>
              {renderOpponent(right, "player-right", "player-right-span")}
              {renderOpponent(top,   "player-top",   "player-top-span")}
              {renderOpponent(left,  "player-left",  "player-left-span")}
            </>
          );
        })()}

        {/* Mesa Central */}
        <div id="table" >
          {tablePieces.map((p, index) => {
            const isDouble = p.sideA === p.sideB;
            return (
              <div key={index} className={`table-piece ${isDouble ? "dupla-piece" : ""}`}>
                <img src={`${BASE}parts/part-${p.sideA}.jpg`} alt={`${p.sideA}`} />
                <img src={`${BASE}parts/part-${p.sideB}.jpg`} alt={`${p.sideB}`} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
