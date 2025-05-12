// Define the Scene class first
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.GameState = { PRESTART: 'prestart', PLAYING: 'playing', GAMEOVER: 'gameover' };
        // Game Objects
        this.player = null; this.chickens = null; this.ground = null;
        // Input
        this.cursors = null; this.keyA = null; this.keyD = null; this.keySpace = null; this.keyS = null;
        // State & Logic
        this.gameState = this.GameState.PRESTART; this.currentLevel = 1;
        this.chickensRemaining = 0; this.isSneaking = false;
        this.panicTimerValue = 10; this.panicTimerEvent = null; this.isPanicTimerRunning = false;
        this.activeChickenSettings = {};
        // Player previous position tracking
        this.playerPrevX = 0; this.playerPrevY = 0;

        // Constants
        this.PLAYER_MOVE_SPEED = 160; this.PLAYER_SNEAK_SPEED = 70; this.PLAYER_JUMP_SPEED = 350;
        this.NORMAL_DETECTION_RADIUS = 200; // NEW constant
        this.SNEAK_MOVEMENT_DETECTION_RADIUS = 100; // NEW constant
        this.WITNESS_PANIC_RADIUS = 250; // NEW: Max distance for witness panic
        this.GAME_GRAVITY = 600;
        // Removed old detection radii

        // Level Settings
        this.levelSettings = [ null,
            { groundSpeed: 60, airSpeed: 90, jumpVelMult: 1.5, jumpProb: 0.01, dirChangeProb: 0.03, idleTurnProb: 0.005 }, // Lvl 1 (Added idleTurnProb)
            { groundSpeed: 80, airSpeed: 120, jumpVelMult: 1.8, jumpProb: 0.02, dirChangeProb: 0.05, idleTurnProb: 0.008 }, // Lvl 2
            { groundSpeed: 100, airSpeed: 150, jumpVelMult: 2.0, jumpProb: 0.03, dirChangeProb: 0.07, idleTurnProb: 0.01 },  // Lvl 3
            { groundSpeed: 110, airSpeed: 170, jumpVelMult: 2.2, jumpProb: 0.04, dirChangeProb: 0.10, idleTurnProb: 0.012 },// Lvl 4
            { groundSpeed: 120, airSpeed: 190, jumpVelMult: 2.4, jumpProb: 0.05, dirChangeProb: 0.13, idleTurnProb: 0.015 } // Lvl 5
        ];
        this.MAX_LEVEL = this.levelSettings.length - 1;

        // UI Elements
        this.chickenCountText = null; this.timerText = null; this.levelText = null;
        this.statusText = null; this.startButton = null; this.restartButton = null;
    }

    preload() { /* ... preload remains the same ... */
        console.log('Preloading assets...');
        this.load.image('fox', 'assets/fox.png');
        this.load.image('chicken', 'assets/chicken.png');
        this.load.image('platform', 'assets/platform.png');
        console.log('Asset preload finished.');
    }

    create() {
        console.log(`Creating Level ${this.currentLevel}...`);
        this.gameState = this.GameState.PRESTART;
        const levelIndex = Math.min(this.currentLevel, this.MAX_LEVEL);
        this.activeChickenSettings = this.levelSettings[levelIndex];
        console.log('Loaded settings:', this.activeChickenSettings);

        // --- Setup Ground ---
        this.ground = this.physics.add.staticGroup();
        this.ground.create(400, 580, 'platform').setScale(1).refreshBody();

        // --- Setup Player ---
        this.player = this.physics.add.sprite(100, 450, 'fox');
        this.player.setBounce(0.1);
        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, this.ground);
        this.playerPrevX = this.player.x; // Initialize previous position
        this.playerPrevY = this.player.y;

        // --- Setup Chickens ---
        this.chickens = this.physics.add.group({ bounceY: 0.3, collideWorldBounds: true });
        // Create chickens slightly above platform
        const startY = 500;
        this.chickens.create(300, startY, 'chicken');
        this.chickens.create(500, startY, 'chicken');
        this.chickens.create(700, startY, 'chicken');
        this.chickens.getChildren().forEach(chicken => {
            chicken.isPanicked = false;
            chicken.facingDirection = (Math.random() < 0.5) ? -1 : 1; // Random initial facing direction
            chicken.setFlipX(chicken.facingDirection < 0); // Set initial flip
        });
        this.chickensRemaining = this.chickens.getChildren().length;
        this.physics.add.collider(this.chickens, this.ground);
        this.physics.add.collider(this.chickens, this.chickens);

        // --- Setup Input ---
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // --- Setup Interaction ---
        this.physics.add.overlap(this.player, this.chickens, this.eatChicken, null, this);

        // --- Setup UI ---
        /* ... UI setup remains the same ... */
        const textStyle = { fontSize: '24px', fill: '#fff' };
        const buttonStyle = { fontSize: '32px', fill: '#0f0', fontStyle: 'bold', backgroundColor: '#555', padding: { x: 10, y: 5 } };
        this.levelText = this.add.text(this.cameras.main.width - 16, 16, `Level: ${levelIndex}`, textStyle).setOrigin(1, 0);
        this.chickenCountText = this.add.text(16, 16, `Chickens: ${this.chickensRemaining}`, textStyle);
        this.timerText = this.add.text(16, 48, 'Panic Timer: -', textStyle);
        this.statusText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 50, '', { fontSize: '48px', fill: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5).setVisible(false);
        this.startButton = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'START GAME', buttonStyle).setOrigin(0.5).setInteractive().on('pointerdown', this.startGame, this);
        this.restartButton = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 50, 'NEXT LEVEL', buttonStyle).setOrigin(0.5).setInteractive().on('pointerdown', this.restartScene, this).setVisible(false);


        // --- Set World Gravity ---
        this.physics.world.gravity.y = this.GAME_GRAVITY;

        // --- Initial State ---
        this.startButton.setVisible(this.gameState === this.GameState.PRESTART);
        this.restartButton.setVisible(this.gameState === this.GameState.GAMEOVER);

        console.log('Create finished. Waiting for start...');
    }

    startGame() { /* ... startGame remains the same ... */
        if (this.gameState !== this.GameState.PRESTART) return;
        this.gameState = this.GameState.PLAYING;
        this.startButton.setVisible(false);
        this.statusText.setVisible(false);
        this.restartButton.setVisible(false);
        this.isPanicTimerRunning = false;
        if(this.panicTimerEvent) this.panicTimerEvent.remove();
        this.panicTimerEvent = null;
        this.timerText.setText('Panic Timer: -');
        this.player.setAlpha(1.0);
        this.playerPrevX = this.player.x; // Reset prev pos on start
        this.playerPrevY = this.player.y;
        this.chickens.getChildren().forEach(c => { c.clearTint(); c.isPanicked = false; });
        console.log('Game state set to PLAYING');
    }

    restartScene() { /* ... restartScene remains the same ... */
         console.log('Restart button clicked, restarting scene...');
         this.isPanicTimerRunning = false;
         if(this.panicTimerEvent) this.panicTimerEvent.remove();
         this.panicTimerEvent = null;
         this.scene.restart();
     }

    update(time, delta) {
        if (this.gameState !== this.GameState.PLAYING) {
             /* ... non-playing state logic remains the same ... */
             if(this.gameState === this.GameState.GAMEOVER) {
                 if (this.player.body) this.player.setVelocity(0);
                 this.chickens.getChildren().forEach(c => { if(c.body) c.setVelocity(0); });
             }
            return;
        }

        // --- GAME LOGIC (runs only when playing) ---
        const playerMoved = this.player.x !== this.playerPrevX || this.player.y !== this.playerPrevY;

        this.handlePlayerMovement(); // Handle input FIRST
        this.updateChickenIdleBehavior(); // Update idle turning SECOND
        this.checkChickenDetection(playerMoved); // Check detection THIRD (pass playerMoved status)
        this.updateChickenMovement(); // Update panicked movement FOURTH

        // Update Timer Display
        if (this.isPanicTimerRunning && this.panicTimerEvent) {
            const remaining = Math.max(0, Math.ceil(this.panicTimerEvent.getRemainingSeconds()));
            this.timerText.setText(`Panic Timer: ${remaining}`);
        }

        // --- Store player position for next frame ---
        this.playerPrevX = this.player.x;
        this.playerPrevY = this.player.y;
    }

    handlePlayerMovement() { /* ... player movement code remains the same ... */
        if (!this.player || !this.player.body) return;
        this.isSneaking = this.keyS.isDown; // Update sneak status based on key
        const currentMoveSpeed = this.isSneaking ? this.PLAYER_SNEAK_SPEED : this.PLAYER_MOVE_SPEED;
        if (this.keyA.isDown || this.cursors.left.isDown) {
            this.player.setVelocityX(-currentMoveSpeed); this.player.setFlipX(true);
        } else if (this.keyD.isDown || this.cursors.right.isDown) {
            this.player.setVelocityX(currentMoveSpeed); this.player.setFlipX(false);
        } else { this.player.setVelocityX(0); }
        this.player.setAlpha(this.isSneaking ? 0.7 : 1.0);
        if (this.keySpace.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(-this.PLAYER_JUMP_SPEED);
        }
    }

    // --- NEW: Handles idle behavior (random turning) ---
    updateChickenIdleBehavior() {
        const settings = this.activeChickenSettings;
        this.chickens.getChildren().forEach(chicken => {
            // Only turn if active and NOT panicked
            if (chicken.active && !chicken.isPanicked) {
                if (Math.random() < settings.idleTurnProb) {
                    chicken.facingDirection *= -1; // Flip direction
                    chicken.setFlipX(chicken.facingDirection < 0);
                    // Optional: Add a small delay before they can turn again?
                }
            }
        });
    }

    // --- REVISED: Chicken Detection Logic ---
    checkChickenDetection(playerMoved) { // Receive player movement status
        if (!this.player) return;

        this.chickens.getChildren().forEach(chicken => {
            if (!chicken.active || chicken.isPanicked) {
                return; // Skip inactive or already panicked chickens
            }

            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, chicken.x, chicken.y);
            const chickenIsFacingPlayer = Math.sign(this.player.x - chicken.x) === chicken.facingDirection;

            let panicTriggered = false;

            // 1. Normal Detection (Not Sneaking)
            if (!this.isSneaking && distance < this.NORMAL_DETECTION_RADIUS) {
                console.log(`Chicken at (${Math.round(chicken.x)}, ${Math.round(chicken.y)}) sees non-sneaking player.`);
                panicTriggered = true;
            }
            // 2. Sneak Detection (Requires Movement & Facing)
            else if (this.isSneaking && playerMoved && distance < this.SNEAK_MOVEMENT_DETECTION_RADIUS && chickenIsFacingPlayer) {
                 console.log(`Chicken at (${Math.round(chicken.x)}, ${Math.round(chicken.y)}) sees sneaking player MOVE while facing.`);
                 panicTriggered = true;
            }

            // Trigger panic if any condition met
            if (panicTriggered) {
                this.panicChicken(chicken);
            }
        });
    }

    // --- REVISED: Panicked Chicken Movement (No changes needed from previous version) ---
    updateChickenMovement() { /* ... Panicked movement code remains the same ... */
        const settings = this.activeChickenSettings;
        const chickenJumpVelocity = -(this.PLAYER_JUMP_SPEED * settings.jumpVelMult);
        this.chickens.getChildren().forEach(chicken => {
            if (chicken.active && chicken.isPanicked && chicken.body) {
                const isOnGround = chicken.body.touching.down;
                const currentPanicSpeed = isOnGround ? settings.groundSpeed : settings.airSpeed;
                if (Math.random() < settings.dirChangeProb) {
                     const moveDirection = (Math.random() < 0.5) ? -1 : 1;
                     chicken.setVelocityX(moveDirection * currentPanicSpeed);
                     chicken.setFlipX(moveDirection < 0);
                } else {
                    const currentSign = Math.sign(chicken.body.velocity.x) || chicken.facingDirection; // Use facing dir if stopped
                     chicken.setVelocityX(currentSign * currentPanicSpeed);
                     // Ensure flip matches velocity/facing direction
                     if (chicken.body.velocity.x !== 0) chicken.setFlipX(chicken.body.velocity.x < 0);
                     else chicken.setFlipX(chicken.facingDirection < 0);
                }
                 if (isOnGround && Math.random() < settings.jumpProb) {
                     chicken.setVelocityY(chickenJumpVelocity);
                 }
            }
        });
    }


    panicChicken(chicken) {
        // Prevent double-panicking in the same frame
        if (!chicken.active || chicken.isPanicked || this.gameState !== this.GameState.PLAYING) return;

        console.log(`Chicken at (${Math.round(chicken.x)}, ${Math.round(chicken.y)}) panicked!`);
        chicken.isPanicked = true;
        chicken.setTint(0xffaaaa);
        // Ensure chicken has some initial velocity when panicked if desired
        if(chicken.body) { // Small initial hop/scoot maybe?
             const moveDirection = (Math.random() < 0.5) ? -1 : 1;
             chicken.setVelocityX(moveDirection * this.activeChickenSettings.groundSpeed * 0.5); // Start slower?
             if(chicken.body.touching.down) chicken.setVelocityY(-(this.PLAYER_JUMP_SPEED * this.activeChickenSettings.jumpVelMult * 0.3)); // Small hop
        }

        if (!this.isPanicTimerRunning) {
            this.startPanicTimer();
        }
    }

    startPanicTimer() { /* ... Timer start logic remains the same ... */
        if (this.isPanicTimerRunning || this.gameState !== this.GameState.PLAYING) return;
        console.log(`Starting global panic timer (${this.panicTimerValue}s)!`);
        this.isPanicTimerRunning = true;
        this.timerText.setText(`Panic Timer: ${this.panicTimerValue}`);
        this.panicTimerEvent = this.time.delayedCall(this.panicTimerValue * 1000, this.onTimerEnd, [], this);
    }

    onTimerEnd() { /* ... Timer end / Lose logic remains the same ... */
        console.log("Panic timer ended!");
        if (this.gameState !== this.GameState.PLAYING) return;
        this.isPanicTimerRunning = false;
        if (this.chickensRemaining > 0) {
            console.log('LOSE - Timer ran out!');
            this.showEndGameMessage(`Level ${this.currentLevel} Failed!`, '#ff0000');
        }
    }

    // --- REVISED: Eat Chicken - includes witness panic ---
    eatChicken(player, eatenChicken) {
        if (!eatenChicken.active || this.gameState !== this.GameState.PLAYING) return;

        const eatenX = eatenChicken.x; // Store position before destroying
        const eatenY = eatenChicken.y;

        console.log(`Chicken eaten at (${Math.round(eatenX)}, ${Math.round(eatenY)})!`);
        eatenChicken.destroy(); // Destroy the chicken

        this.chickensRemaining--;
        this.chickenCountText.setText(`Chickens: ${this.chickensRemaining}`);
        console.log(`Chickens remaining: ${this.chickensRemaining}`);

        // --- Witness Panic Check ---
        this.chickens.getChildren().forEach(witnessChicken => {
            // Skip if witness is inactive or already panicked
            if (!witnessChicken.active || witnessChicken.isPanicked) {
                return;
            }

            const distanceToEvent = Phaser.Math.Distance.Between(witnessChicken.x, witnessChicken.y, eatenX, eatenY);

            // Check if witness is close enough
            if (distanceToEvent < this.WITNESS_PANIC_RADIUS) {
                // Check if witness is facing the direction of the eaten chicken
                const isFacingEvent = Math.sign(eatenX - witnessChicken.x) === witnessChicken.facingDirection;
                if (isFacingEvent) {
                    console.log(`Witness chicken at (${Math.round(witnessChicken.x)}, ${Math.round(witnessChicken.y)}) saw the event!`);
                    this.panicChicken(witnessChicken); // Panic the witness
                }
            }
        });
        // --- End Witness Panic Check ---


        // Check for Win Condition
        if (this.chickensRemaining === 0) {
            this.winGame();
        }
    }


    winGame() { /* ... Win game logic remains the same ... */
        if (this.gameState !== this.GameState.PLAYING) return;
        console.log(`WIN - Level ${this.currentLevel} Complete!`);
        const levelToShow = this.currentLevel;
        this.currentLevel++;
        if (levelToShow >= this.MAX_LEVEL) {
            this.showEndGameMessage(`ALL LEVELS COMPLETE!`, '#00ffaa');
             this.currentLevel = this.MAX_LEVEL + 1;
             this.restartButton.setText('PLAY AGAIN?');
        } else {
            this.showEndGameMessage(`Level ${levelToShow} Complete!`, '#00ff00');
            this.restartButton.setText(`START LEVEL ${this.currentLevel}`);
        }
        if (this.panicTimerEvent) { this.panicTimerEvent.remove(false); }
        this.timerText.setText('Panic Timer: -');
    }


    showEndGameMessage(message, color) { /* ... showEndGameMessage logic remains the same ... */
        this.gameState = this.GameState.GAMEOVER;
        this.statusText.setText(message).setFill(color).setVisible(true);
        if (message.includes('Failed')) {
             this.restartButton.setText('TRY AGAIN?');
             this.restartButton.off('pointerdown').on('pointerdown', this.restartScene, this); // Ensure correct listener
        } else if (this.currentLevel > this.MAX_LEVEL) {
             this.restartButton.setText('PLAY AGAIN?');
             this.restartButton.off('pointerdown').on('pointerdown', () => {
                 this.currentLevel = 1; this.restartScene();
             }, this);
        } else {
             // Text already set in winGame
             this.restartButton.off('pointerdown').on('pointerdown', this.restartScene, this); // Ensure correct listener
        }
        this.restartButton.setVisible(true);
        this.isPanicTimerRunning = false;
        if (this.panicTimerEvent) this.panicTimerEvent.remove();
        console.log('Game state set to GAMEOVER');
    }

} // --- End of GameScene class ---


// --- Game Configuration (No changes needed) ---
const config = {
    type: Phaser.CANVAS, width: 800, height: 600, parent: 'game-container',
    backgroundColor: '#333333',
    physics: { default: 'arcade', arcade: { debug: false /* Set true to debug physics */ } },
    scene: [GameScene]
};

// --- Create Game Instance (No changes needed) ---
console.log("Window loaded, starting Phaser game...");
const game = new Phaser.Game(config);