"use client"

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Matter from 'matter-js';

const TEAM_SIZE = 13;
const GAME_DURATION = 120;
const WINNING_SCORE = 5;
const POWERUP_DURATION = 10;
const POWERUP_SPAWN_INTERVAL = 15;

enum GamePhase {
  START,
  PLAYING,
  END
}

enum PowerUpType {
  SPEED_BOOST,
  SUPER_KICK,
  MAGNET_BALL
}

interface PowerUp {
  type: PowerUpType;
  body: Matter.Body;
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

    // Load sound effects
    const kickSound = new Audio('/sounds/kick.mp3');
    const goalSound = new Audio('/sounds/goal.mp3');
    const powerUpSound = new Audio('/sounds/powerup.mp3');

    // Field setup (walls, goals, markings)
    const wallThickness = 50;
    const walls = [
      Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, { 
        isStatic: true,
        render: { fillStyle: '#2E7D32' }  // Darker green for walls
      }),
      Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, { 
        isStatic: true,
        render: { fillStyle: '#2E7D32' }
      }),
      Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, { 
        isStatic: true,
        render: { fillStyle: '#2E7D32' }
      }),
      Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, { 
        isStatic: true,
        render: { fillStyle: '#2E7D32' }
      }),
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

    // Create teams with improved visuals
    const createPlayer = (x: number, y: number, color: string) => {
      return Bodies.circle(x, y, 20, {
        restitution: 0.5,
        friction: 0,
        frictionAir: 0,
        density: 0.001,
        inertia: Infinity,
        inverseInertia: 0,
        render: { 
          fillStyle: color,
          strokeStyle: 'black',
          lineWidth: 2
        }
      });
    };


    const team1 = Array.from({ length: TEAM_SIZE }, (_, i) => 
      createPlayer(width / 4, (i + 1) * height / (TEAM_SIZE + 1), '#FF4136')  // Brighter red
    );

    const team2 = Array.from({ length: TEAM_SIZE }, (_, i) => 
      createPlayer(3 * width / 4, (i + 1) * height / (TEAM_SIZE + 1), '#0074D9')  // Brighter blue
    );

    const ball = Bodies.circle(width / 2, height / 2, 15, {
      restitution: 0.8,
      friction: 0.1,
      frictionAir: 0.005,
      density: 0.0005,
      render: { 
        fillStyle: 'white',
        strokeStyle: 'black',
        lineWidth: 2
      }
    });

    Composite.add(world, [...team1, ...team2, ball, ...walls, leftGoal, rightGoal]);

    // Power-up related variables
    let activePowerUps: PowerUp[] = [];
    let playerPowerUp: PowerUpType | null = null;
    let powerUpTimeLeft = 0;

    // Create a power-up with improved visuals
    const createPowerUp = (): PowerUp => {
      const type = Math.floor(Math.random() * 3) as PowerUpType;
      const x = Math.random() * (width - 100) + 50;
      const y = Math.random() * (height - 100) + 50;
      const color = type === PowerUpType.SPEED_BOOST ? '#FFDC00' : 
                    type === PowerUpType.SUPER_KICK ? '#FF851B' : '#B10DC9';
      
      const body = Bodies.circle(x, y, 15, {
        isStatic: true,
        isSensor: true,
        render: { 
          fillStyle: color,
          strokeStyle: 'white',
          lineWidth: 2
        }
      });

      return { type, body };
    };

    // Spawn power-ups
    const spawnPowerUp = () => {
      const powerUp = createPowerUp();
      activePowerUps.push(powerUp);
      Composite.add(world, powerUp.body);
    };

    // Set up power-up spawning interval
    const powerUpInterval = setInterval(spawnPowerUp, POWERUP_SPAWN_INTERVAL * 1000);

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
        const baseSpeed = 5;
        const speed = player === team1[0] && playerPowerUp === PowerUpType.SPEED_BOOST ? baseSpeed * 1.5 : baseSpeed;
        const velocity = Vector.mult(Vector.normalise(direction), speed);
        Body.setVelocity(player, velocity);
      };
  
      // Ball kicking with sound effect
      const kickBall = (kicker: Matter.Body, ball: Matter.Body) => {
        const baseKickForce = 0.03;
        const kickForce = kicker === team1[0] && playerPowerUp === PowerUpType.SUPER_KICK ? baseKickForce * 2 : baseKickForce;
        const distance = Vector.magnitude(Vector.sub(ball.position, kicker.position));
        const kickRange = 50;
  
        if (distance < kickRange) {
          const direction = Vector.normalise(Vector.sub(ball.position, kicker.position));
          const force = Vector.mult(direction, kickForce);
          Body.applyForce(ball, ball.position, force);
          
          kickSound.play();
          
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

      // Apply magnet ball effect
      if (playerPowerUp === PowerUpType.MAGNET_BALL) {
        const player = team1[0];
        const toBall = Vector.sub(ball.position, player.position);
        const distance = Vector.magnitude(toBall);
        if (distance < 200) {
          const force = Vector.mult(Vector.normalise(toBall), -0.001 * (200 - distance));
          Body.applyForce(ball, ball.position, force);
        }
      }

      // Check for power-up collisions
      activePowerUps = activePowerUps.filter(powerUp => {
        const collision = Matter.Collision.collides(team1[0], powerUp.body);
        if (collision) {
          playerPowerUp = powerUp.type;
          powerUpTimeLeft = POWERUP_DURATION;
          Composite.remove(world, powerUp.body);
          powerUpSound.play();
          return false;
        }
        return true;
      });

      // Update power-up timer
      if (powerUpTimeLeft > 0) {
        powerUpTimeLeft -= 1 / 60; // Assuming 60 FPS
        if (powerUpTimeLeft <= 0) {
          playerPowerUp = null;
        }
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

      moveAI(team2, leftGoal); // Move AI team
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

    // Scoring and reset with sound effect and visual feedback
    Events.on(engine, 'collisionStart', (event) => {
        event.pairs.forEach((pair) => {
          if (pair.bodyA === ball || pair.bodyB === ball) {
            const goal = pair.bodyA === ball ? pair.bodyB : pair.bodyA;
            if (goal === leftGoal || goal === rightGoal) {
              goalSound.play();
              
              // Visual feedback for goal
              const goalFlash = Bodies.rectangle(width / 2, height / 2, width, height, {
                isStatic: true,
                isSensor: true,
                render: {
                  fillStyle: 'rgba(255, 255, 255, 0.5)'
                }
              });
              Composite.add(world, goalFlash);
              setTimeout(() => Composite.remove(world, goalFlash), 500);
  
              if (goal === leftGoal) {
                setScore(prev => ({ ...prev, player2: prev.player2 + 1 }));
              } else {
                setScore(prev => ({ ...prev, player1: prev.player1 + 1 }));
              }
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      
      // Draw field markings
      ctx.beginPath();
      ctx.moveTo(fieldMarkings.centerLine.x, 0);
      ctx.lineTo(fieldMarkings.centerLine.x, height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(fieldMarkings.centerCircle.x, fieldMarkings.centerCircle.y, fieldMarkings.centerCircle.radius, 0, 2 * Math.PI);
      ctx.stroke();

      // Draw power-up timer
      if (playerPowerUp !== null) {
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.fillText(`Power-up: ${PowerUpType[playerPowerUp]} (${Math.ceil(powerUpTimeLeft)}s)`, 10, height - 10);
      }

      // Draw player indicator
      ctx.fillStyle = '#FF4136';
      ctx.beginPath();
      ctx.moveTo(team1[0].position.x, team1[0].position.y - 30);
      ctx.lineTo(team1[0].position.x - 10, team1[0].position.y - 40);
      ctx.lineTo(team1[0].position.x + 10, team1[0].position.y - 40);
      ctx.closePath();
      ctx.fill();
    });

    // Game timer
    const gameInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0 || Math.max(score.player1, score.player2) >= WINNING_SCORE) {
          clearInterval(gameInterval);
          clearInterval(powerUpInterval);
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(gameInterval);
      clearInterval(powerUpInterval);
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