class CPU {
    constructor(renderer, keyboard, speaker) {
        this.renderer = renderer;
        this.keyboard = keyboard;
        this.speaker = speaker;

        // 4KB (4096 bytes) of memory
        this.memory = new Uint8Array(4096);

        //16 8-bit registers
        // 8 bit unsigned integers.
        this.v = new Uint8Array(16);

        // Store memory address. Set this to 0 since we aren't storing anything at initialization
        this.i = 0;

        // timers
        this.delayTimer = 0;
        this.soundTimer = 0;

        // Program counter. Stores the currently executing address.
        this.pc = 0x200;

        // Initialized this without size to avoid empty results.
        this.stack = new Array();

        // Some instructions require pausing, such as Fx0A.
        this.paused = false;

        this.speed = 10;
    }

    /**
     * chip-8 uses 16 5 byte sprites (0 -> F in hexadecimal).
     */
    loadSpritesIntoMemory() {
        // We will simply store the hex values of the sprites from the technical doc.
        const sprites = [
            0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
            0x20, 0x60, 0x20, 0x20, 0x70, // 1
            0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
            0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
            0x90, 0x90, 0xF0, 0x10, 0x10, // 4
            0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
            0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
            0xF0, 0x10, 0x20, 0x40, 0x40, // 7
            0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
            0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
            0xF0, 0x90, 0xF0, 0x90, 0x90, // A
            0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
            0xF0, 0x80, 0x80, 0x80, 0xF0, // C
            0xE0, 0x90, 0x90, 0x90, 0xE0, // D
            0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
            0xF0, 0x80, 0xF0, 0x80, 0x80  // F
        ];
        // The sprites are stored in the interpreter section of memory (0x000 -> 0x1FF).
        for (let i = 0; i < sprites.length; i++) {
            this.memory[i] = sprites[i];
        }

    }

    /**
     *  Loading the ROM (read-only memory) into memory.
     *  Following the spec, most chip-8 programs start at location 0x200.
     */
    loadProgramIntoMemory(program) {
        for (let loc = 0; loc < program.length; loc++) {
            this.memory[0x200 + loc] = program[loc];
        }
    }

    /**
     * Grab ROM from filesystem
     * In this project the will be located in the roms folder. 
     */
    loadRom(romName) {
        const request = new XMLHttpRequest;
        const self = this;

        request.onload = () => {
            if (request.response) {
                // Store contents in 8-bit array
                let program = new Uint8Array(request.response);

                // Load the ROM/program into memory
                self.loadProgramIntoMemory(program);
            }
        }

        request.open("GET", "roms/" + romName);
        request.responseType = "arraybuffer";

        request.send();
    }

    cycle() {
        // First is a for loop that handles the execution of instructions.
        for (let i = 0; i < this.speed; i++) {
            // Only execute instructions if the emulator is running.
            if (!this.paused) {
                // Get opcode from memory
                let opcode = (this.memory[this.pc] << 8 | this.memory[this.pc + 1]);
                this.executeInstruction(opcode);
            }
        }

        if (!this.paused) {
            this.uptateTimers();
        }

        this.playSound();
        this.renderer.render();
    }

    updateTimers() {
        if (this.delayTimer > 0) {
            this.delayTimer -= 1;
        }

        if (this.soundTimer > 0) {
            this.soundTimer -= 1;
        }
    }

    playSound() {
        if (this.soundTimer > 0) {
            this.speaker.play(440);
        } else {
            this.speaker.stop();
        }
    }

    executeInstruction(opcode) {
        // When executing this function keep in mind to increment the program counter by 2 instead of 1.
        // Each instruction is 2 bytes.
        this.pc += 2;
        
        // Get the second nibble (4 bits), 0x0F00, the F stands on the second place.
        // Shift right 8 bits to get rid of everything but that 2nd nibble. 
        // 0x0F00 = 0000 1111 0000 0000
        let x = (opcode & 0x0F00) >> 8;

        // We want the third nibble
        // Shift right 4 bits to get rid of everything but that 3rd nibble.
        let y = (opcode & 0x00F0) >> 4;

        // Grabbing the upper 4 bits of the most significant byte of the opcode.
        switch (opcode & 0xF000) {
            case 0x0000:
                switch (opcode) {
                    // Clear the display
                    case 0x00E0:
                        this.renderer.clear();
                        break;
                    // Return from a subroutine.
                    // The interpreter sets the PC (program counter) to the address at the top of the stack, then subtracts 1 from the stack pointer.
                    // But because we use an array we don't need to worry about the stack pointer.
                    case 0x00EE:
                        this.pc = this.stack.pop();
                        break;
                }
        
                break;
            // PC will be set to the value stored in nnn.
            case 0x1000:
                this.pc = (opcode & 0xFFF);
                break;
            // Grab value from nnn + push this.pc on stack.
            case 0x2000:
                this.stack.push(this.pc);
                this.pc = (opcode & 0xFFF);
                break;
            // Skip next instruction if Vx = kk.
            // If equal PC is incremented with 2.
            case 0x3000:
                // 0xFF will grab the last byte of the opcode (kk portion of opcode)
                if (this.v[x] === (opcode & 0xFF)) {
                    this.pc += 2;
                }
                break;
            // Skip next instruction if Vx != kk.
            // If not equal PC is incremented by 2.
            case 0x4000:
                if (this.v[x] !== (opcode & 0xFF)) {
                    this.pc += 2;
                }
                break;
            // Skip next instruction if Vx = Vy.
            case 0x5000:
                if (this.v[x] === this.v[y]) {
                    this.pc += 2;
                }
                break;
            // Set Vx == kk. Put value kk in register Vx.
            case 0x6000:
                this.v[x] = (opcode & 0xFF);
                break;
            // Set Vx to Vx + kk.
            case 0x7000:
                this.v[x] += (opcode & 0xFF);
                break;
            // Under 0x8000 falls 0-7 and E. Thats why there is a switch in a switch.
            case 0x8000:
                // This switch will grab the last nibble and see if it is one of the following cases.
                switch (opcode & 0xF) {
                    // Set Vx = Vy, store value of register Vy in Vx
                    case 0x0:
                        this.v[x] = this.v[y];
                        break;
                    // Vx = Vx OR Vy
                    // Bitwise OR on Vx and Vy and stores the result.
                    case 0x1:
                        this.v[x] |= this.v[y];
                        break;
                    // Vx = Vx AND Vy
                    case 0x2:
                        this.v[x] &= this.v[y];
                        break;
                    // Vx = Vx XOR Vy
                    case 0x3:
                        this.v[x] ^= this.v[y]
                        break;
                    // Vx = Vx + Vy, VF = carry
                    // Vx and Vy are added together, if the result is more than 8 bits (>255), VF is set to 1. Otherwise VF is set to 0. The lowest 8 bits are kept.
                    case 0x4:
                        let sum = (this.v[x] += this.v[y]);

                        // VF
                        this.v[0xF] = 0;

                        if (sum > 0xFF) {
                            this.v[0xF] = 1;
                        }

                        // this.v is a unit8array and will automatically keep the lowest 8 bits when the result is over 8 bits.
                        this.v[x] = sum;
                        break;
                    // Set Vx = Vx - Vy, set VF = NOT borrow
                    // IF Vx > Vy, then VF is set to 1, otherwise 0. Then Vy is subtracted from Vx and the result is stored in Vx.
                    case 0x5:
                        this.v[0xF] = 0;

                        if (this.v[x] > this.v[y]) {
                            this.v[0xF] = 1
                        }

                        this.v[x] -= this.v[y];
                        break;
                    // Set Vx = Vx SHR 1
                    // If the least significant bit of Vx is 1, then VF is set to 1, otherwise 0. Then Vx is divided by 2.
                    case 0x6:
                        // 0x1 is hex for 00000001
                        this.v[0xF] = (this.v[x] & 0x1);

                        this.v[x] >>= 1;
                        break;
                    // Set Vx = Vy - Vx, set VF = NOT borrow
                    // if Vy > Vx, then VF is set to 1, otherwise 0. Then Vx is subtracted from Vy and result is stored in Vx.
                    case 0x7:
                        this.v[0xF] = 0;

                        if (this.v[x] < this.v[y]) {
                            this.v[0xF] = 1;
                        }

                        this.v[x] = this.v[y] - this.v[x];
                        break;
                    // Set Vx = Vx SHL 1
                    // If most significant bit of Vx is 1, the VF is set 1, otherwise to 0. Then Vx is multiplied by 2.
                    case 0xE:
                        // 0x80 is hex for 10000000.
                        // 0x8 = 1000 and 0x0 = 0000.
                        this.v[0xF] = (this.v[x] & 0x80);

                        this.v[x] <<= 1;
                        break;
                }
        
                break;
            // Skip next instruction if Vx != Vy.
            // Values of Vx and Vy are compared, if not equal, the PC is increased by 2.
            case 0x9000:
                if (this.v[x] !== this.v[y]) {
                    this.pc += 2;
                }
                break;
            // Set I = nnn
            // The value of Register I is set to nnn.
            case 0xA000:
                this.i = (opcode & 0xFFF);
                break;
            case 0xB000:
                break;
            case 0xC000:
                break;
            case 0xD000:
                break;
            case 0xE000:
                switch (opcode & 0xFF) {
                    case 0x9E:
                        break;
                    case 0xA1:
                        break;
                }
        
                break;
            case 0xF000:
                switch (opcode & 0xFF) {
                    case 0x07:
                        break;
                    case 0x0A:
                        break;
                    case 0x15:
                        break;
                    case 0x18:
                        break;
                    case 0x1E:
                        break;
                    case 0x29:
                        break;
                    case 0x33:
                        break;
                    case 0x55:
                        break;
                    case 0x65:
                        break;
                }
        
                break;
        
            default:
                throw new Error('Unknown opcode ' + opcode);
        }
    }
}

export default CPU;