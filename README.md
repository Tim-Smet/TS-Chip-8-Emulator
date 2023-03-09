# TS-Chip-8-Emulator
Technical documentation: http://devernay.free.fr/hacks/chip8/C8TECH10.HTM#2.4

Based on a tutorial from freecodecamp.

Chip-8 is a simple, interpreted, programming language. It can access up to 4KB of RAM from location 0x000 (0) to 0xFFF (4095). The first 512 bytes are reserved for the interpreter, from 0x000 to 0x1FF. Most programs start at location 0x200 (512). 
Chip-8 programs are run a virtual machine.

Chip-8 draws graphics to the screen via the use of sprites. A sprite is a group of bytes that are a binary representation of the desired pictures.
The max is 15 rows of one byte.
Example: "6" <br/>
11110000    **** <br/>
10000000    *    <br/>
11110000    **** <br/>
10010000    *  * <br/>
11110000    **** <br/>

## Learnings
- Shifting between hex and binary.
- Bitwise operation AND, OR, XOR.
- Shifting bits left and right.
