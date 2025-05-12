// Define the Scene class first
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        // --- Game Objects ---
        this.player = null;
        this.chickens = null; // Group for chickens
        this.ground = null;

        // --- Input ---
        this.cursors = null;
        this.keyA = null;
        this.keyD = null;
        this.keySpace = null;
        this.keyS = null;

        // --- Game State & Logic ---
        this.chickensRemaining = 0;
        this.isSneaking = false;
        this.panicTimerValue = 10; // Initial timer duration in seconds
        this.panicTimerEvent = null;
        this.isPanicTimerRunning = false;

        // --- Constants ---
        this.PLAYER_MOVE_SPEED = 160;
        this.PLAYER_SNEAK_SPEED = 70;
        this.PLAYER_JUMP_SPEED = 350;
        this.CHICKEN_DETECTION_RADIUS = 150;
        this.CHICKEN_SNEAK_DETECTION_RADIUS = 60; // Player needs to be closer when sneaking to be noticed
        this.GAME_GRAVITY = 500;

        // --- UI Elements ---
        this.chickenCountText = null;
        this.timerText = null;
        this.statusText = null; // For Win/Loss messages
    }

    preload() {
        console.log('Preloading assets...');
        // Load images from the assets folder
        // The keys ('fox', 'chicken', 'platform') are used later in create()
        this.load.image('fox', 'assets/fox.png');
        this.load.image('chicken', 'assets/chicken.png');
        this.load.image('platform', 'assets/platform.png');
        console.log('Asset preload finished.');
    }

    create() {
        console.log('Creating game objects...');

        // --- Setup Ground ---
        this.ground = this.physics.add.staticGroup();
        // Create the platform sprite using the loaded 'platform' image key
        // Position it at the bottom center. Scale if needed. Refresh body is important.
        this.ground.create(400, 580, 'platform').setScale(1).refreshBody(); // Adjust Y position (580) if platform image height is different

        // --- Setup Player (Fox) ---
        // Create the player sprite using the loaded 'fox' image key
        this.player = this.physics.add.sprite(100, 450, 'fox');
        this.player.setBounce(0.1);
        this.player.setCollideWorldBounds(true); // Prevent falling off screen
        this.physics.add.collider(this.player, this.ground); // Make player stand on the ground

        // --- Setup Chickens ---
        this.chickens = this.physics.add.group({
            allowGravity: false, // Chickens don't fall
            immovable: true      // Chickens don't get pushed by player physics
        });

        // Create some chickens using the loaded 'chicken' image key
        // Adjust Y positions (e.g., 535) based on your platform height and chicken sprite size
        this.chickens.create(300, 535, 'chicken');
        this.chickens.create(500, 535, 'chicken');
        this.chickens.create(700, 535, 'chicken');

        // Add custom properties to each chicken
        this.chickens.getChildren().forEach(chicken => {
            chicken.isPanicked = false; // Custom flag
            // Optional: Set origin if your chicken sprite isn't centered
            // chicken.setOrigin(0.5, 0.5);
        });

        this.chickensRemaining = this.chickens.getChildren().length;

        // --- Setup Input ---
        this.cursors = this.input.keyboard.createCursorKeys(); // Arrow keys + Space
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // --- Setup Interaction ---
        // Call 'eatChicken' when player overlaps with any sprite in the 'chickens' group
        this.physics.add.overlap(
            this.player,
            this.chickens,
            this.eatChicken, // Callback function
            null,            // Process callback (optional, null here)
            this             // Context for the callback (this scene)
        );

        // --- Setup UI ---
        const textStyle = { fontSize: '24px', fill: '#fff' };
        this.chickenCountText = this.add.text(16, 16, `Chickens: ${this.chickensRemaining}`, textStyle);
        this.timerText = this.add.text(16, 48, 'Panic Timer: -', textStyle);
        this.statusText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, '', { fontSize: '48px', fill: '#ff0000', fontStyle: 'bold' })
            .setOrigin(0.5)
            .setVisible(false); // Hide initially

        console.log('Create finished.');
    }

    update(time, delta) {
        // --- Check Game Over State ---
        // If win/loss message is showing, stop player and further updates
        if (this.statusText.visible) {
             if (this.player.body) { // Check if body exists before setting velocity
                this.player.setVelocity(0);
             }
             return;
        }

        // --- Player Movement ---
        this.handlePlayerMovement();

        // --- Chicken Detection ---
        this.checkChickenDetection();

        // --- Update Timer Display ---
        if (this.isPanicTimerRunning && this.panicTimerEvent) {
            // Calculate remaining seconds, ensuring it doesn't go below 0
            const remaining = Math.max(0, Math.ceil(this.panicTimerEvent.getRemainingSeconds()));
            this.timerText.setText(`Panic Timer: ${remaining}`);
        }
    }

    handlePlayerMovement() {
        if (!this.player || !this.player.body) return; // Exit if player not ready

        // Check Sneak Key
        this.isSneaking = this.keyS.isDown;

        const currentMoveSpeed = this.isSneaking ? this.PLAYER_SNEAK_SPEED : this.PLAYER_MOVE_SPEED;

        // Horizontal Movement (A/D or Left/Right)
        if (this.keyA.isDown || this.cursors.left.isDown) {
            this.player.setVelocityX(-currentMoveSpeed);
            this.player.setFlipX(true); // Flip sprite to face left
        } else if (this.keyD.isDown || this.cursors.right.isDown) {
            this.player.setVelocityX(currentMoveSpeed);
            this.player.setFlipX(false); // Sprite faces right (default)
        } else {
            this.player.setVelocityX(0); // Stop horizontal movement
        }

        // Tint player slightly when sneaking for visual feedback
        if (this.isSneaking) {
            this.player.setAlpha(0.7); // Make slightly transparent
        } else {
            this.player.setAlpha(1.0); // Normal opacity
        }

        // Jumping (Space) - only if touching the ground/platform
        if (this.keySpace.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(-this.PLAYER_JUMP_SPEED);
        }
    }

    checkChickenDetection() {
        if (!this.player) return; // Exit if player not ready

        // Iterate through all active chickens in the group
        this.chickens.getChildren().forEach(chicken => {
            // Skip if chicken has been destroyed (is inactive) or is already panicked
            if (!chicken.active || chicken.isPanicked) {
                return;
            }

            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                chicken.x, chicken.y
            );

            // Panic condition: Player is NOT sneaking AND is within the NORMAL detection radius
            if (!this.isSneaking && distance < this.CHICKEN_DETECTION_RADIUS) {
                this.panicChicken(chicken);
            }
            // Note: We are *not* explicitly checking the SNEAK radius here to cause panic.
            // Sneaking *prevents* panic unless the player gets very close and interacts (overlaps).
            // If you wanted sneaking *within* the sneak radius to also cause panic, you'd add:
            // else if (this.isSneaking && distance < this.CHICKEN_SNEAK_DETECTION_RADIUS) {
            //     this.panicChicken(chicken); // Or maybe a different 'alert' state?
            // }
        });
    }

    panicChicken(chicken) {
        // Double-check conditions to prevent re-panicking
        if (!chicken.active || chicken.isPanicked) return;

        console.log('Chicken panicked!');
        chicken.isPanicked = true;
        chicken.setTint(0xffaaaa); // Apply a light red tint

        // Start the global panic timer ONLY if it's not already running
        if (!this.isPanicTimerRunning) {
            this.startPanicTimer();
        }
    }

    startPanicTimer() {
        if (this.isPanicTimerRunning) return; // Prevent multiple timers

        console.log(`Starting global panic timer (${this.panicTimerValue}s)!`);
        this.isPanicTimerRunning = true;
        this.timerText.setText(`Panic Timer: ${this.panicTimerValue}`); // Initial display

        // Use Phaser's timer event for delayed callback
        this.panicTimerEvent = this.time.delayedCall(
            this.panicTimerValue * 1000, // Duration in milliseconds
            this.onTimerEnd,             // Function to call when timer finishes
            [],                          // Arguments to pass to the callback (none needed)
            this                         // Context for the callback (this scene)
        );
    }

    onTimerEnd() {
        console.log("Panic timer ended!");
        this.isPanicTimerRunning = false; // Timer has finished

        // Check for Loss Condition: Only lose if timer ends AND chickens remain AND win message isn't already shown
        if (this.chickensRemaining > 0 && !this.statusText.visible) {
            console.log('LOSE - Timer ran out!');
            this.showEndGameMessage('LOSE!', '#ff0000'); // Red for loss
        }
    }

    eatChicken(player, chicken) {
        // Prevent eating inactive or already processed chickens
        if (!chicken.active) return;

        console.log('Chicken eaten!');
        chicken.destroy(); // Remove the chicken sprite from the game completely

        this.chickensRemaining--;
        this.chickenCountText.setText(`Chickens: ${this.chickensRemaining}`);
        console.log(`Chickens remaining: ${this.chickensRemaining}`);

        // Check for Win Condition
        if (this.chickensRemaining === 0) {
            this.winGame();
        }
    }

    winGame() {
        console.log('WIN - All chickens caught!');
        // Only show win message if the loss message isn't already visible
        if (!this.statusText.visible) {
            this.showEndGameMessage('WIN!', '#00ff00'); // Green for win

            // Stop the panic timer if it was running when player won
            if (this.panicTimerEvent) {
                console.log('Stopping panic timer due to win.');
                this.panicTimerEvent.remove(false); // false = don't call the onTimerEnd callback
                // No need to reset isPanicTimerRunning, game is ending
            }
             // Make timer text neutral if the game ended by winning
             this.timerText.setText('Panic Timer: -');
        }
    }

    // Helper function to display end game message and pause
    showEndGameMessage(message, color) {
        this.statusText.setText(message).setFill(color).setVisible(true);
        this.physics.pause(); // Stop all physics movement

        // Optional: Tint player to indicate game over state
        if (this.player) {
             this.player.setTint(color === '#00ff00' ? 0xaaffaa : 0xffaaaa);
        }
    }

} // --- End of GameScene class ---


// --- Game Configuration ---
const config = {
    type: Phaser.CANVAS, // Keep using Canvas for reliability based on previous issues
    width: 800,
    height: 600,
    parent: 'game-container', // Matches the div ID in index.html
    backgroundColor: '#333333', // Background color outside game area
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 500 }, // Global gravity affecting the player
            debug: false         // Set true to see physics bodies/velocities
        }
    },
    scene: [GameScene] // The scene class to run
};

// --- Create Game Instance ---
// Runs once the script is loaded
console.log("Window loaded, starting Phaser game...");
const game = new Phaser.Game(config);