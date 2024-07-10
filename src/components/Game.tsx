"use client"

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Matter from 'matter-js';

const Game = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [score, setScore] = useState({ player1: 0, player2: 0 });

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    const { Engine, Render, Runner, Bodies, Composite, Events, Body, Vector } = Matter;

    // Create engine with zero gravity
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

    // Create field boundaries (make them static and sensors)
    const wallThickness = 50;
    const walls = [
      Bodies.rectangle(width / 2, -wallThickness / 2, width, wallThickness, { isStatic: true, isSensor: true }), // Top
      Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, { isStatic: true, isSensor: true }), // Bottom
      Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height, { isStatic: true, isSensor: true }), // Left
      Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height, { isStatic: true, isSensor: true }), // Right
    ];

    // Create goals (keep them as sensors)
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

    // Create field markings (purely visual, not physical bodies)
    const fieldMarkings = {
      centerLine: { x: width / 2, y: height / 2, w: 2, h: height },
      centerCircle: { x: width / 2, y: height / 2, radius: 50 }
    };

    const player = Bodies.circle(width / 4, height / 2, 20, { 
      restitution: 0.5,
      friction: 0.1,
      frictionAir: 0.02,
      inertia: Infinity, // Prevents rotation
      inverseInertia: 0,
      render: { fillStyle: 'red' }
    });

    const aiPlayer = Bodies.circle(3 * width / 4, height / 2, 20, { 
      restitution: 0.5,
      friction: 0.1,
      frictionAir: 0.02,
      inertia: Infinity, // Prevents rotation
      inverseInertia: 0,
      render: { fillStyle: 'blue' }
    });

    const ball = Bodies.circle(width / 2, height / 2, 15, {
      restitution: 0.9,
      friction: 0.1,
      frictionAir: 0.01,
      render: { fillStyle: 'white' }
    });

    Composite.add(world, [player, aiPlayer, ball, ...walls, leftGoal, rightGoal]);

    const handleKeyDown = (event: KeyboardEvent) => {
      const force = 0.001;
      switch (event.key) {
        case 'ArrowUp':
          Body.applyForce(player, player.position, { x: 0, y: -force });
          break;
        case 'ArrowDown':
          Body.applyForce(player, player.position, { x: 0, y: force });
          break;
        case 'ArrowLeft':
          Body.applyForce(player, player.position, { x: -force, y: 0 });
          break;
        case 'ArrowRight':
          Body.applyForce(player, player.position, { x: force, y: 0 });
          break;
        case ' ': // Spacebar for kicking
          kickBall(player, ball);
          break;
      }

      newSocket.emit('move', {
        position: player.position,
        velocity: player.velocity,
      });
    };

    const kickBall = (kicker: Matter.Body, ball: Matter.Body) => {
      const kickForce = 0.02;
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

    window.addEventListener('keydown', handleKeyDown);

    newSocket.on('move', (data) => {
      Body.setPosition(player, data.position);
      Body.setVelocity(player, data.velocity);
    });

    newSocket.on('kick', (data) => {
      Body.setPosition(ball, data.ballPosition);
      Body.setVelocity(ball, data.ballVelocity);
    });

    // AI player movement
    const moveAIPlayer = () => {
      const forceMagnitude = 0.0005;
      const toBall = Vector.sub(ball.position, aiPlayer.position);
      const toGoal = Vector.sub({x: 0, y: height / 2}, aiPlayer.position);
      
      let force;
      if (ball.position.x > width / 2) {
        force = Vector.mult(Vector.normalise(toBall), forceMagnitude);
      } else {
        force = Vector.mult(Vector.normalise(toGoal), forceMagnitude);
      }

      Body.applyForce(aiPlayer, aiPlayer.position, force);

      const kickRange = 50;
      if (Vector.magnitude(Vector.sub(ball.position, aiPlayer.position)) < kickRange) {
        kickBall(aiPlayer, ball);
      }
    };

    Events.on(engine, 'beforeUpdate', moveAIPlayer);

    // Handle scoring
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
      Body.setPosition(player, { x: width / 4, y: height / 2 });
      Body.setVelocity(player, { x: 0, y: 0 });
      Body.setPosition(aiPlayer, { x: 3 * width / 4, y: height / 2 });
      Body.setVelocity(aiPlayer, { x: 0, y: 0 });
    };

    // Custom render function to draw field markings
    Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      
      // Draw center line
      ctx.beginPath();
      ctx.moveTo(fieldMarkings.centerLine.x, 0);
      ctx.lineTo(fieldMarkings.centerLine.x, height);
      ctx.stroke();
      
      // Draw center circle
      ctx.beginPath();
      ctx.arc(fieldMarkings.centerCircle.x, fieldMarkings.centerCircle.y, fieldMarkings.centerCircle.radius, 0, 2 * Math.PI);
      ctx.stroke();
    });

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      render.canvas.width = width;
      render.canvas.height = height;
      render.options.width = width;
      render.options.height = height;
      
      // Update positions of walls and goals
      Body.setPosition(walls[0], { x: width / 2, y: -wallThickness / 2 });
      Body.setPosition(walls[1], { x: width / 2, y: height + wallThickness / 2 });
      Body.setPosition(walls[2], { x: -wallThickness / 2, y: height / 2 });
      Body.setPosition(walls[3], { x: width + wallThickness / 2, y: height / 2 });
      Body.setPosition(leftGoal, { x: goalWidth / 2, y: height / 2 });
      Body.setPosition(rightGoal, { x: width - goalWidth / 2, y: height / 2 });
      
      // Update field markings
      fieldMarkings.centerLine = { x: width / 2, y: height / 2, w: 2, h: height };
      fieldMarkings.centerCircle = { x: width / 2, y: height / 2, radius: 50 };
      
      resetPositions();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      newSocket.disconnect();
      Render.stop(render);
      Runner.stop(runner);
      Composite.clear(world, false);
      Engine.clear(engine);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', fontSize: '24px' }}>
        Score: {score.player1} - {score.player2}
      </div>
      <div style={{ position: 'absolute', bottom: 10, left: 10, color: 'white', fontSize: '18px' }}>
        Use arrow keys to move, spacebar to kick
      </div>
    </>
  );
};

export default Game;