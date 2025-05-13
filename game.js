// Define the Scene class first
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.GameState = { PRESTART: 'prestart', PLAYING: 'playing', GAMEOVER: 'gameover' };
        this.player = null; this.kererus = null; this.ground = null;
        this.cursors = null; this.keyA = null; this.keyD = null; this.keySpace = null; this.keyS = null;
        this.gameState = this.GameState.PRESTART; this.currentLevel = 1;
        this.kererusRemaining = 0; this.isSneaking = false;
        this.panicTimerValue = 10; this.panicTimerEvent = null; this.isPanicTimerRunning = false;
        this.activeKereruSettings = {};
        this.playerPrevX = 0; this.playerPrevY = 0;

        this.PLAYER_MOVE_SPEED = 160; this.PLAYER_SNEAK_SPEED = 70; this.PLAYER_JUMP_SPEED = 350;
        this.NORMAL_DETECTION_RADIUS = 200; this.SNEAK_MOVEMENT_DETECTION_RADIUS = 100;
        this.WITNESS_PANIC_RADIUS = 250; this.GAME_GRAVITY = 600;
        this.CHICKEN_GLIDE_DRAG_Y = 150;

        // Player Physics Body Constants (Based on fox.png: 85w x 50h)
        this.PLAYER_SPRITE_FRAME_WIDTH_NORMAL = 85;
        this.PLAYER_SPRITE_FRAME_HEIGHT_NORMAL = 50;
        this.PLAYER_BODY_WIDTH = 45;
        this.PLAYER_BODY_HEIGHT = 48;
        this.PLAYER_BODY_OFFSET_X = (this.PLAYER_SPRITE_FRAME_WIDTH_NORMAL - this.PLAYER_BODY_WIDTH) / 2;
        this.PLAYER_BODY_OFFSET_Y = (this.PLAYER_SPRITE_FRAME_HEIGHT_NORMAL - this.PLAYER_BODY_HEIGHT);

        this.levelSettings = [ null, /* ... level settings ... */
            { groundSpeed: 60, airSpeed: 90, jumpVelMult: 1.5, jumpProb: 0.01, dirChangeProb: 0.03, idleTurnProb: 0.005 },
            { groundSpeed: 80, airSpeed: 120, jumpVelMult: 1.8, jumpProb: 0.02, dirChangeProb: 0.05, idleTurnProb: 0.008 },
            { groundSpeed: 100, airSpeed: 150, jumpVelMult: 2.0, jumpProb: 0.03, dirChangeProb: 0.07, idleTurnProb: 0.01 },
            { groundSpeed: 110, airSpeed: 170, jumpVelMult: 2.2, jumpProb: 0.04, dirChangeProb: 0.10, idleTurnProb: 0.012 },
            { groundSpeed: 120, airSpeed: 190, jumpVelMult: 2.4, jumpProb: 0.05, dirChangeProb: 0.13, idleTurnProb: 0.015 }
        ];
        this.MAX_LEVEL = this.levelSettings.length - 1;
        this.kereruCountText = null; this.timerText = null; this.levelText = null;
        this.statusText = null; this.startButton = null; this.restartButton = null;
    }

    preload() { /* ... same ... */
        console.log('Preloading assets...');
        this.load.image('fox', 'assets/fox.png');
        this.load.image('kereru', 'assets/kereru.png');
        this.load.image('platform', 'assets/platform.png');
        this.load.image('fox_jump', 'assets/fox2.png');
        this.load.image('kereru_jump', 'assets/kereru2.png');
        this.load.image('fox_sneak', 'assets/fox3.png');
        console.log('Asset preload finished.');
    }

    create() { /* ... same ... */
        console.log(`Creating Level ${this.currentLevel}...`);
        this.gameState = this.GameState.PRESTART;
        const levelIndex = Math.min(this.currentLevel, this.MAX_LEVEL);
        this.activeKereruSettings = this.levelSettings[levelIndex];
        this.ground = this.physics.add.staticGroup();
        this.ground.create(400, 580, 'platform').setScale(1).refreshBody();
        this.player = this.physics.add.sprite(100, 450, 'fox');
        this.player.setBounce(0.1);
        this.player.setCollideWorldBounds(true);
        this.playerPrevX = this.player.x; this.playerPrevY = this.player.y;
        this.player.setData('currentTextureKey', 'fox');
        if (this.player.body) {
            this.player.body.setSize(this.PLAYER_BODY_WIDTH, this.PLAYER_BODY_HEIGHT);
            this.player.body.setOffset(this.PLAYER_BODY_OFFSET_X, this.PLAYER_BODY_OFFSET_Y);
            console.log(`Initial player body SET ONCE - Size: ${this.PLAYER_BODY_WIDTH}x${this.PLAYER_BODY_HEIGHT}, Offset: (${this.PLAYER_BODY_OFFSET_X}, ${this.PLAYER_BODY_OFFSET_Y})`);
        }
        this.kererus = this.physics.add.group({ bounceY: 0.3, collideWorldBounds: true });
        const startY = 500;
        this.kererus.create(300, startY, 'kereru');
        this.kererus.create(500, startY, 'kereru');
        this.kererus.create(700, startY, 'kereru');
        this.kererus.getChildren().forEach(kereru => {
            kereru.isPanicked = false;
            kereru.facingDirection = (Math.random() < 0.5) ? -1 : 1;
            kereru.setFlipX(kereru.facingDirection < 0);
            kereru.setData('currentTextureKey', 'kereru');
            kereru.body.setDragY(0);
        });
        this.kererusRemaining = this.kererus.getChildren().length;
        this.physics.add.collider(this.player, this.ground);
        this.physics.add.collider(this.kererus, this.ground);
        this.physics.add.collider(this.kererus, this.kererus);
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.physics.add.overlap(this.player, this.kererus, this.eatKereru, null, this);
        const textStyle = { fontSize: '24px', fill: '#fff' };
        const buttonStyle = { fontSize: '32px', fill: '#0f0', fontStyle: 'bold', backgroundColor: '#555', padding: { x: 10, y: 5 } };
        this.levelText = this.add.text(this.cameras.main.width - 16, 16, `Level: ${levelIndex}`, textStyle).setOrigin(1, 0);
        this.kereruCountText = this.add.text(16, 16, `Kererus: ${this.kererusRemaining}`, textStyle);
        this.timerText = this.add.text(16, 48, 'Panic Timer: -', textStyle);
        this.statusText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 50, '', { fontSize: '48px', fill: '#ff0000', fontStyle: 'bold' }).setOrigin(0.5).setVisible(false);
        this.startButton = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, 'START GAME', buttonStyle).setOrigin(0.5).setInteractive().on('pointerdown', this.startGame, this);
        this.restartButton = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY + 50, 'NEXT LEVEL', buttonStyle).setOrigin(0.5).setInteractive().on('pointerdown', this.restartScene, this).setVisible(false);
        this.physics.world.gravity.y = this.GAME_GRAVITY;
        this.startButton.setVisible(this.gameState === this.GameState.PRESTART);
        this.restartButton.setVisible(this.gameState === this.GameState.GAMEOVER);
        console.log('Create finished. Waiting for start...');
    }

    startGame() { /* ... same ... */
        if (this.gameState !== this.GameState.PRESTART) return;
        this.gameState = this.GameState.PLAYING;
        this.startButton.setVisible(false); this.statusText.setVisible(false); this.restartButton.setVisible(false);
        this.isPanicTimerRunning = false; if(this.panicTimerEvent) this.panicTimerEvent.remove(); this.panicTimerEvent = null;
        this.timerText.setText('Panic Timer: -');
        this.player.setAlpha(1.0);
        this.player.setTexture('fox'); this.player.setData('currentTextureKey', 'fox');
        this.playerPrevX = this.player.x; this.playerPrevY = this.player.y;
        this.isSneaking = false;
        this.kererus.getChildren().forEach(c => {
            c.clearTint(); c.isPanicked = false; c.body.setDragY(0);
            c.setTexture('kereru'); c.setData('currentTextureKey', 'kereru');
        });
        console.log('Game state set to PLAYING');
    }

    restartScene() { /* ... same ... */
         console.log('Restart button clicked, restarting scene...');
         this.isPanicTimerRunning = false;
         if(this.panicTimerEvent) this.panicTimerEvent.remove();
         this.panicTimerEvent = null;
         this.scene.restart();
    }

    update(time, delta) { /* ... same ... */
        if (this.gameState !== this.GameState.PLAYING) {
             if(this.gameState === this.GameState.GAMEOVER) {
                 if (this.player.body) this.player.setVelocity(0);
                 this.kererus.getChildren().forEach(c => { if(c.body) c.setVelocity(0); });
             }
            return;
        }
        const playerMoved = this.player.x !== this.playerPrevX || this.player.y !== this.playerPrevY;
        this.handlePlayerMovement();
        this.updateSpriteTextures();
        this.updateKereruIdleBehavior();
        this.checkKereruDetection(playerMoved);
        this.updateKereruMovement();
        if (this.isPanicTimerRunning && this.panicTimerEvent) {
            const remaining = Math.max(0, Math.ceil(this.panicTimerEvent.getRemainingSeconds()));
            this.timerText.setText(`Panic Timer: ${remaining}`);
        }
        this.playerPrevX = this.player.x;
        this.playerPrevY = this.player.y;
    }

    handlePlayerMovement() { /* ... same ... */
        if (!this.player || !this.player.body) return;
        let currentlyHoldingSneak = this.keyS.isDown;
        let didJump = false;
        if (this.keySpace.isDown && this.player.body.blocked.down && !this.isSneaking) {
            this.player.setVelocityY(-this.PLAYER_JUMP_SPEED);
            this.isSneaking = false;
            currentlyHoldingSneak = false;
            didJump = true;
        }
        if (!didJump) { this.isSneaking = currentlyHoldingSneak; }
        const currentMoveSpeed = this.isSneaking ? this.PLAYER_SNEAK_SPEED : this.PLAYER_MOVE_SPEED;
        if (this.keyA.isDown || this.cursors.left.isDown) {
            this.player.setVelocityX(-currentMoveSpeed); this.player.setFlipX(true);
        } else if (this.keyD.isDown || this.cursors.right.isDown) {
            this.player.setVelocityX(currentMoveSpeed); this.player.setFlipX(false);
        } else { this.player.setVelocityX(0); }
        this.player.setAlpha(this.isSneaking ? 0.7 : 1.0);
    }

    updateKereruIdleBehavior() { /* ... same ... */
        const settings = this.activeKereruSettings;
        this.kererus.getChildren().forEach(kereru => {
            if (kereru.active && !kereru.isPanicked) {
                if (Math.random() < settings.idleTurnProb) {
                    kereru.facingDirection *= -1;
                    kereru.setFlipX(kereru.facingDirection < 0);
                }
            }
        });
    }
    checkKereruDetection(playerMoved) { /* ... same ... */
        if (!this.player) return;
        this.kererus.getChildren().forEach(kereru => {
            if (!kereru.active || kereru.isPanicked) return;
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, kereru.x, kereru.y);
            const kereruIsFacingPlayer = Math.sign(this.player.x - kereru.x) === kereru.facingDirection;
            let panicTriggered = false;
            if (!this.isSneaking && distance < this.NORMAL_DETECTION_RADIUS) {
                panicTriggered = true;
            } else if (this.isSneaking && playerMoved && distance < this.SNEAK_MOVEMENT_DETECTION_RADIUS && kereruIsFacingPlayer) {
                 panicTriggered = true;
            }
            if (panicTriggered) { this.panicKereru(kereru); }
        });
    }
    updateKereruMovement() { /* ... same ... */
        const settings = this.activeKereruSettings;
        const kereruJumpVelocity = -(this.PLAYER_JUMP_SPEED * settings.jumpVelMult);
        this.kererus.getChildren().forEach(kereru => {
            if (!kereru.active || !kereru.body) return;
            const isOnGround = kereru.body.blocked.down;
            if (kereru.isPanicked) {
                const currentPanicSpeed = isOnGround ? settings.groundSpeed : settings.airSpeed;
                if (!isOnGround) { kereru.body.setDragY(this.CHICKEN_GLIDE_DRAG_Y); }
                else { kereru.body.setDragY(0); }
                if (Math.random() < settings.dirChangeProb) {
                     const moveDirection = (Math.random() < 0.5) ? -1 : 1;
                     kereru.setVelocityX(moveDirection * currentPanicSpeed);
                     kereru.facingDirection = moveDirection; kereru.setFlipX(moveDirection < 0);
                } else {
                    const currentSign = Math.sign(kereru.body.velocity.x) || kereru.facingDirection;
                     kereru.setVelocityX(currentSign * currentPanicSpeed);
                     if (kereru.body.velocity.x !== 0) kereru.setFlipX(kereru.body.velocity.x < 0);
                     else kereru.setFlipX(kereru.facingDirection < 0);
                }
                 if (isOnGround && Math.random() < settings.jumpProb) {
                     kereru.setVelocityY(kereruJumpVelocity);
                 }
            } else { kereru.body.setDragY(0); }
        });
    }

     // --- REVISED: Update textures with landing flash fix ---
     updateSpriteTextures() {
        // Player
        if (this.player && this.player.body) {
            const playerOnGround = this.player.body.blocked.down;
            const playerVelocityY = this.player.body.velocity.y;
            const currentTextureKey = this.player.getData('currentTextureKey');
            let targetPlayerKey = currentTextureKey; // Default to current to avoid unnecessary changes

            if (playerOnGround) {
                if (this.isSneaking) {
                    targetPlayerKey = 'fox_sneak';
                } else {
                    // If on ground and not sneaking, ensure it's 'fox'
                    // This handles landing and normal ground state.
                    targetPlayerKey = 'fox';
                }
            } else { // Airborne
                // Only switch to jump sprite if significant upward velocity
                if (playerVelocityY < -50) { // Adjust this threshold as needed
                    targetPlayerKey = 'fox_jump';
                } else if (currentTextureKey === 'fox_jump' && playerVelocityY >= 0) {
                    // If currently 'fox_jump' and has reached apex or is falling, switch back to 'fox'
                    targetPlayerKey = 'fox';
                }
                // If falling and was 'fox' or 'fox_sneak', it remains 'fox' (or 'fox_sneak' if isSneaking is somehow true airborne, but handlePlayerMovement prevents this on jump)
                // The primary case here is to ensure 'fox_jump' reverts to 'fox' mid-air when falling.
                // If this.isSneaking is true while airborne (e.g., snuck off a ledge), it will show 'fox' due to !playerOnGround.
                // If you want a specific airborne sneak sprite, that would be another condition.
            }

            if (currentTextureKey !== targetPlayerKey) {
                const oldFlipX = this.player.flipX;
                this.player.setTexture(targetPlayerKey);
                this.player.setData('currentTextureKey', targetPlayerKey);
                this.player.setFlipX(oldFlipX);
                // console.log(`Player Texture: ${targetPlayerKey}, Ground: ${playerOnGround}, VelY: ${playerVelocityY.toFixed(2)}`);
            }
        }

        // Kererus
        this.kererus.getChildren().forEach(kereru => {
             if (kereru.active && kereru.body) {
                 const kereruOnGround = kereru.body.blocked.down;
                 const targetKereruKey = kereruOnGround ? 'kereru' : 'kereru_jump';
                 if (kereru.getData('currentTextureKey') !== targetKereruKey) {
                     const oldFlipX = kereru.flipX;
                     kereru.setTexture(targetKereruKey);
                     kereru.setData('currentTextureKey', targetKereruKey);
                     kereru.setFlipX(oldFlipX);
                 }
             }
         });
    }


    panicKereru(kereru) { /* ... same ... */
        if (!kereru.active || kereru.isPanicked || this.gameState !== this.GameState.PLAYING) return;
        console.log(`Kereru at (${Math.round(kereru.x)}, ${Math.round(kereru.y)}) panicked!`);
        kereru.isPanicked = true;
        kereru.setTint(0xffaaaa);
        if(kereru.body) {
             const moveDirection = kereru.facingDirection * -1;
             kereru.facingDirection = moveDirection; kereru.setFlipX(moveDirection < 0);
             kereru.setVelocityX(moveDirection * this.activeKereruSettings.groundSpeed * 0.6);
             if(kereru.body.blocked.down) kereru.setVelocityY(-(this.PLAYER_JUMP_SPEED * this.activeKereruSettings.jumpVelMult * 0.4));
        }
        if (!this.isPanicTimerRunning) { this.startPanicTimer(); }
    }
    startPanicTimer() { /* ... same ... */
        if (this.isPanicTimerRunning || this.gameState !== this.GameState.PLAYING) return;
        console.log(`Starting global panic timer (${this.panicTimerValue}s)!`);
        this.isPanicTimerRunning = true;
        this.timerText.setText(`Panic Timer: ${this.panicTimerValue}`);
        this.panicTimerEvent = this.time.delayedCall(this.panicTimerValue * 1000, this.onTimerEnd, [], this);
    }
    onTimerEnd() { /* ... same ... */
        console.log("Panic timer ended!");
        if (this.gameState !== this.GameState.PLAYING) return;
        this.isPanicTimerRunning = false;
        if (this.kererusRemaining > 0) {
            console.log('LOSE - Timer ran out!');
            this.showEndGameMessage(`Level ${this.currentLevel} Failed!`, '#ff0000');
        }
    }
    eatKereru(player, eatenKereru) { /* ... same ... */
        if (!eatenKereru.active || this.gameState !== this.GameState.PLAYING) return;
        const eatenX = eatenKereru.x; const eatenY = eatenKereru.y;
        console.log(`Kereru eaten at (${Math.round(eatenX)}, ${Math.round(eatenY)})!`);
        eatenKereru.destroy();
        this.kererusRemaining--;
        this.kereruCountText.setText(`Kererus: ${this.kererusRemaining}`);
        console.log(`Kererus remaining: ${this.kererusRemaining}`);
        this.kererus.getChildren().forEach(witnessKereru => {
            if (!witnessKereru.active || witnessKereru.isPanicked) return;
            const distanceToEvent = Phaser.Math.Distance.Between(witnessKereru.x, witnessKereru.y, eatenX, eatenY);
            if (distanceToEvent < this.WITNESS_PANIC_RADIUS) {
                const isFacingEvent = Math.sign(eatenX - witnessKereru.x) === witnessKereru.facingDirection;
                if (isFacingEvent) {
                    console.log(`Witness kereru saw event!`);
                    this.panicKereru(witnessKereru);
                }
            }
        });
        if (this.kererusRemaining === 0) { this.winGame(); }
    }
    winGame() { /* ... same ... */
        if (this.gameState !== this.GameState.PLAYING) return;
        console.log(`WIN - Level ${this.currentLevel} Complete!`);
        const levelToShow = this.currentLevel;
        this.currentLevel++;
        if (levelToShow >= this.MAX_LEVEL) {
            this.showEndGameMessage(`ALL LEVELS COMPLETE!`, '#00ffaa');
             this.currentLevel = this.MAX_LEVEL + 1; this.restartButton.setText('PLAY AGAIN?');
        } else {
            this.showEndGameMessage(`Level ${levelToShow} Complete!`, '#00ff00');
            this.restartButton.setText(`START LEVEL ${this.currentLevel}`);
        }
        if (this.panicTimerEvent) { this.panicTimerEvent.remove(false); }
        this.timerText.setText('Panic Timer: -');
    }
    showEndGameMessage(message, color) { /* ... same ... */
        this.gameState = this.GameState.GAMEOVER;
        this.statusText.setText(message).setFill(color).setVisible(true);
        if (message.includes('Failed')) {
             this.restartButton.setText('TRY AGAIN?');
             this.restartButton.off('pointerdown').on('pointerdown', this.restartScene, this);
        } else if (this.currentLevel > this.MAX_LEVEL) {
             this.restartButton.setText('PLAY AGAIN?');
             this.restartButton.off('pointerdown').on('pointerdown', () => {
                 this.currentLevel = 1; this.restartScene();
             }, this);
        } else {
             this.restartButton.off('pointerdown').on('pointerdown', this.restartScene, this);
        }
        this.restartButton.setVisible(true);
        this.isPanicTimerRunning = false;
        if (this.panicTimerEvent) this.panicTimerEvent.remove();
        console.log('Game state set to GAMEOVER');
    }

} // --- End of GameScene class ---

// --- Game Configuration ---
const config = {
    type: Phaser.CANVAS, width: 800, height: 600, parent: 'game-container',
    backgroundColor: '#333333',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false // <<<--- KEEP TRUE FOR ADJUSTING BODY CONSTANTS IN CONSTRUCTOR
        }
    },
    scene: [GameScene]
};

// --- Create Game Instance ---
console.log("Window loaded, starting Phaser game...");
const game = new Phaser.Game(config);
