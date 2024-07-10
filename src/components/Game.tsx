"use client"

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Matter from 'matter-js';

const TEAM_SIZE = 3; // Number of players per team
const GAME_DURATION = 120; // 2 minutes game time
const WINNING_SCORE = 5; // First team to score 5 goals wins

enum GamePhase {
  START,
  PLAYING,
  END
}

const StartScreen = ({ onStart }: { onStart: () => void }) => (
  <div style={{
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    zIndex: 20,
  }}>
    <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>Soccer Game</h1>
    <button
      onClick={onStart}
      style={{
        fontSize: '24px',
        padding: '10px 20px',
        background: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
      }}
    >
      Start Game
    </button>
  </div>
);

const EndScreen = ({ score, onRestart }: { score: { player1: number, player2: number }, onRestart: () => void }) => (
  <div style={{
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    zIndex: 20,
  }}>
    <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>Game Over</h1>
    <h2 style={{ fontSize: '36px', marginBottom: '20px' }}>
      {score.player1 > score.player2 ? 'You Win!' : score.player1 < score.player2 ? 'AI Wins!' : 'It\'s a Draw!'}
    </h2>
    <p style={{ fontSize: '24px', marginBottom: '20px' }}>Final Score: {score.player1} - {score.player2}</p>
    <button
      onClick={onRestart}
      style={{
        fontSize: '24px',
        padding: '10px 20px',
        background: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
      }}
    >
      Play Again
    </button>
  </div>
);


const Game = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [score, setScore] = useState({ player1: 0, player2: 0 });
    const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
    const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.START);
  
    const startGame = () => {
      setGamePhase(GamePhase.PLAYING);
      setScore({ player1: 0, player2: 0 });
      setTimeLeft(GAME_DURATION);
    };
  
    const endGame = () => {
      setGamePhase(GamePhase.END);
    };
  
    useEffect(() => {
      if (gamePhase !== GamePhase.PLAYING) return;
  
      const newSocket = io();
      setSocket(newSocket);
  
      const { Engine, Render, Runner, Bodies, Composite, Events, Body, Vector } = Matter;
  
      const engine = Engine.create({
        gravity: { scale: 0, x: 0, y: 0 }
      });
      
      const world = engine.world;
  
      const width = window.innerWidth;
      const height = window.innerHeight;
  
      const render = Render.create({
        element: document.body,
        engine: engine,
        canvas: canvasRef.current!,
        options: {
          width: width,
          height: height,
          wireframes: false,
          background: '#4CAF50',
        },
      });
  
      Render.run(render);
      const runner = Runner.create();
      Runner.run(runner, engine);

    // Field setup (walls, goals, markings)
    const wallThickness = 50;
    const walls = [
      Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, { isStatic: true }),
      Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, { isStatic: true }),
      Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, { isStatic: true }),
      Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, { isStatic: true }),
    ];

    const goalWidth = 20;
    const goalHeight = 200;
    const leftGoal = Bodies.rectangle(goalWidth / 2, height / 2, goalWidth, goalHeight, { 
      isStatic: true,
      isSensor: true,
      render: { fillStyle: 'white' }
    });
    const rightGoal = Bodies.rectangle(width - goalWidth / 2, height / 2, goalWidth, goalHeight, { 
      isStatic: true,
      isSensor: true,
      render: { fillStyle: 'white' }
    });

    const fieldMarkings = {
      centerLine: { x: width / 2, y: height / 2, w: 2, h: height },
      centerCircle: { x: width / 2, y: height / 2, radius: 50 }
    };

    // Create teams with adjusted physics properties
    const createPlayer = (x: number, y: number, color: string) => {
      return Bodies.circle(x, y, 20, {
        restitution: 0.5,
        friction: 0,
        frictionAir: 0,
        density: 0.001,
        inertia: Infinity,
        inverseInertia: 0,
        render: { fillStyle: color }
      });
    };

    const team1 = Array.from({ length: TEAM_SIZE }, (_, i) => 
      createPlayer(width / 4, (i + 1) * height / (TEAM_SIZE + 1), 'red')
    );

    const team2 = Array.from({ length: TEAM_SIZE }, (_, i) => 
      createPlayer(3 * width / 4, (i + 1) * height / (TEAM_SIZE + 1), 'blue')
    );

    const ball = Bodies.circle(width / 2, height / 2, 15, {
      restitution: 0.8,
      friction: 0.1,
      frictionAir: 0.005,
      density: 0.0005,
      render: { fillStyle: 'white' }
    });

    Composite.add(world, [...team1, ...team2, ball, ...walls, leftGoal, rightGoal]);

    // Player controls
    const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key in keys) {
        keys[event.key as keyof typeof keys] = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key in keys) {
        keys[event.key as keyof typeof keys] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Unified movement function for both player and AI
    const movePlayer = (player: Matter.Body, direction: Matter.Vector) => {
      const speed = 5; // Adjust this value to change the movement speed
      const velocity = Vector.mult(Vector.normalise(direction), speed);
      Body.setVelocity(player, velocity);
    };

    // Ball kicking
    const kickBall = (kicker: Matter.Body, ball: Matter.Body) => {
      const kickForce = 0.03;
      const distance = Vector.magnitude(Vector.sub(ball.position, kicker.position));
      const kickRange = 50;

      if (distance < kickRange) {
        const direction = Vector.normalise(Vector.sub(ball.position, kicker.position));
        const force = Vector.mult(direction, kickForce);
        Body.applyForce(ball, ball.position, force);
        
        newSocket.emit('kick', {
          ballPosition: ball.position,
          ballVelocity: ball.velocity,
        });
      }
    };

    // Handle spacebar for kicking
    const handleSpacebar = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        kickBall(team1[0], ball);
      }
    };

    window.addEventListener('keydown', handleSpacebar);

    Events.on(engine, 'beforeUpdate', () => {
      // Player movement
      const playerDirection = { x: 0, y: 0 };
      if (keys.ArrowUp) playerDirection.y -= 1;
      if (keys.ArrowDown) playerDirection.y += 1;
      if (keys.ArrowLeft) playerDirection.x -= 1;
      if (keys.ArrowRight) playerDirection.x += 1;

      if (playerDirection.x !== 0 || playerDirection.y !== 0) {
        movePlayer(team1[0], playerDirection);
      } else {
        Body.setVelocity(team1[0], { x: 0, y: 0 });
      }

      // AI movement
      const moveAI = (team: Matter.Body[], opposingGoal: Matter.Body) => {
        team.forEach((player) => {
          const toBall = Vector.sub(ball.position, player.position);
          movePlayer(player, toBall);

          // AI kicking
          const kickRange = 50;
          if (Vector.magnitude(toBall) < kickRange) {
            const toGoal = Vector.sub(opposingGoal.position, player.position);
            if (Vector.dot(toGoal, toBall) > 0) {
              kickBall(player, ball);
            }
          }
        });
      };

      moveAI(team2.slice(1), leftGoal); // Move AI team
      moveAI(team1.slice(1), rightGoal); // Move AI teammates

      // Keep the ball within the field
      const ballRadius = 15;
      const minX = ballRadius;
      const maxX = width - ballRadius;
      const minY = ballRadius;
      const maxY = height - ballRadius;

      if (ball.position.x < minX) {
        Body.setPosition(ball, { x: minX, y: ball.position.y });
        Body.setVelocity(ball, { x: -ball.velocity.x * 0.5, y: ball.velocity.y });
      } else if (ball.position.x > maxX) {
        Body.setPosition(ball, { x: maxX, y: ball.position.y });
        Body.setVelocity(ball, { x: -ball.velocity.x * 0.5, y: ball.velocity.y });
      }

      if (ball.position.y < minY) {
        Body.setPosition(ball, { x: ball.position.x, y: minY });
        Body.setVelocity(ball, { x: ball.velocity.x, y: -ball.velocity.y * 0.5 });
      } else if (ball.position.y > maxY) {
        Body.setPosition(ball, { x: ball.position.x, y: maxY });
        Body.setVelocity(ball, { x: ball.velocity.x, y: -ball.velocity.y * 0.5 });
      }
    });

    // Scoring and reset
    Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        if (pair.bodyA === ball || pair.bodyB === ball) {
          const goal = pair.bodyA === ball ? pair.bodyB : pair.bodyA;
          if (goal === leftGoal) {
            setScore(prev => ({ ...prev, player2: prev.player2 + 1 }));
            resetPositions();
          } else if (goal === rightGoal) {
            setScore(prev => ({ ...prev, player1: prev.player1 + 1 }));
            resetPositions();
          }
        }
      });
    });

    const resetPositions = () => {
      Body.setPosition(ball, { x: width / 2, y: height / 2 });
      Body.setVelocity(ball, { x: 0, y: 0 });
      team1.forEach((player, i) => {
        Body.setPosition(player, { x: width / 4, y: (i + 1) * height / (TEAM_SIZE + 1) });
        Body.setVelocity(player, { x: 0, y: 0 });
      });
      team2.forEach((player, i) => {
        Body.setPosition(player, { x: 3 * width / 4, y: (i + 1) * height / (TEAM_SIZE + 1) });
        Body.setVelocity(player, { x: 0, y: 0 });
      });
    };

    // Custom render function for field markings
    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(fieldMarkings.centerLine.x, 0);
      ctx.lineTo(fieldMarkings.centerLine.x, height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(fieldMarkings.centerCircle.x, fieldMarkings.centerCircle.y, fieldMarkings.centerCircle.radius, 0, 2 * Math.PI);
      ctx.stroke();
    });

    // Game timer
    const gameInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0 || Math.max(score.player1, score.player2) >= WINNING_SCORE) {
          clearInterval(gameInterval);
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(gameInterval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('keydown', handleSpacebar);
      newSocket.disconnect();
      Render.stop(render);
      Runner.stop(runner);
      Composite.clear(world, false);
      Engine.clear(engine);
    };
  }, [gamePhase]);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      {gamePhase === GamePhase.START && <StartScreen onStart={startGame} />}
      {gamePhase === GamePhase.END && <EndScreen score={score} onRestart={startGame} />}
      {gamePhase === GamePhase.PLAYING && (
        <>
          <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', fontSize: '24px', zIndex: 10 }}>
            Score: {score.player1} - {score.player2}
          </div>
          <div style={{ position: 'absolute', top: 10, right: 10, color: 'white', fontSize: '24px', zIndex: 10 }}>
            Time: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
          <div style={{ position: 'absolute', bottom: 10, left: 10, color: 'white', fontSize: '18px', zIndex: 10 }}>
            Use arrow keys to move (including diagonally), spacebar to kick
          </div>
        </>
      )}
    </>
  );
};

export default Game;