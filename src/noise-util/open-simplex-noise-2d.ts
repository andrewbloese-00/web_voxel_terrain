// Code derived from the following repo: 
// https://github.com/joshforisha/open-simplex-noise-js


export type NoiseFn2d = (x:number,y:number)=>number
export type __2dContribution__ = {
    dx: number
    dy: number
    xsb:number
    ysb: number
    next?: __2dContribution__
}

export function _shuffle_seed(seed:Uint32Array) {
    var newSeed = new Uint32Array(1);
    newSeed[0] = seed[0] * 1664525 + 1013904223;
    return newSeed;
}

export function n_shuffle_seed(seed:number, n:number){
    let s = new Uint32Array(1)
    s[0] = seed
    for(let i = 0; i < n; i++){
        s = _shuffle_seed(s)
    }
    return s[0]
}

const NORM_2D = 1.0 / 47.0;
const SQUISH_2D = (Math.sqrt(2 + 1) - 1) / 2;
const STRETCH_2D = (1 / Math.sqrt(2 + 1) - 1) / 2;
const base2D = [
    [1, 1, 0, 1, 0, 1, 0, 0, 0],
    [1, 1, 0, 1, 0, 1, 2, 1, 1],
];
const gradients2D = [
    5,
    2,
    2,
    5,
    -5,
    2,
    -2,
    5,
    5,
    -2,
    2,
    -5,
    -5,
    -2,
    -2,
    -5,
];
const lookupPairs2D = [
    0,
    1,
    1,
    0,
    4,
    1,
    17,
    0,
    20,
    2,
    21,
    2,
    22,
    5,
    23,
    5,
    26,
    4,
    39,
    3,
    42,
    4,
    43,
    3,
];
const p2D = [
    0,
    0,
    1,
    -1,
    0,
    0,
    -1,
    1,
    0,
    2,
    1,
    1,
    1,
    2,
    2,
    0,
    1,
    2,
    0,
    2,
    1,
    0,
    0,
    0,
];

function contribution2D(multiplier:number, xsb:number, ysb:number) {
    
    const c :__2dContribution__=  {
        dx: -xsb - multiplier * SQUISH_2D,
        dy: -ysb - multiplier * SQUISH_2D,
        xsb: xsb,
        ysb: ysb,
        
    };
    return c
}
export function make2dNoise(clientSeed:number,normalize=true):NoiseFn2d {
    var contributions:__2dContribution__[] = [];
    for (var i = 0; i < p2D.length; i += 4) {
        var baseSet = base2D[p2D[i]];
        var previous = null;
        var current = null;
        for (var k = 0; k < baseSet.length; k += 3) {
            current = contribution2D(baseSet[k], baseSet[k + 1], baseSet[k + 2]);
            if (previous === null)
                contributions[i / 4] = current;
            else
                previous.next = current;
            previous = current;
        }
        if(current) current.next = contribution2D(p2D[i + 1], p2D[i + 2], p2D[i + 3]);
    }
    const lookup:(__2dContribution__|undefined)[] = [];
    for (var i = 0; i < lookupPairs2D.length; i += 2) {
        lookup[lookupPairs2D[i]] = contributions[lookupPairs2D[i + 1]];
    }
    const perm = new Uint8Array(256);
    const perm2D = new Uint8Array(256);
    const source = new Uint8Array(256);
    for (var i = 0; i < 256; i++)
        source[i] = i;
    let seed = new Uint32Array(1);
    seed[0] = clientSeed;
    seed = _shuffle_seed(_shuffle_seed(_shuffle_seed(seed)));
    for (var i = 255; i >= 0; i--) {
        seed = _shuffle_seed(seed);
        var r = new Uint32Array(1);
        r[0] = (seed[0] + 31) % (i + 1);
        if (r[0] < 0)
            r[0] += i + 1;
        perm[i] = source[r[0]];
        perm2D[i] = perm[i] & 0x0e;
        source[r[0]] = source[i];
    }
    return function (x:number, y:number) {
        let stretchOffset = (x + y) * STRETCH_2D;
        let xs = x + stretchOffset;
        let ys = y + stretchOffset;
        let xsb = Math.floor(xs);
        let ysb = Math.floor(ys);
        let squishOffset = (xsb + ysb) * SQUISH_2D;
        let dx0 = x - (xsb + squishOffset);
        let dy0 = y - (ysb + squishOffset);
        let xins = xs - xsb;
        let yins = ys - ysb;
        let inSum = xins + yins;
        let hash = (xins - yins + 1) |
            (inSum << 1) |
            ((inSum + yins) << 2) |
            ((inSum + xins) << 4);
        let value = 0;


        for (let c = lookup[hash]; c !== undefined; c = c.next) {
            const dx = dx0 + c.dx;
            const dy = dy0 + c.dy;
            const attn = 2 - dx * dx - dy * dy;
            if (attn > 0) {
                const px = xsb + c.xsb;
                const py = ysb + c.ysb;
                const indexPartA = perm[px & 0xff];
                const index = perm2D[(indexPartA + py) & 0xff];
                const valuePart = gradients2D[index] * dx + gradients2D[index + 1] * dy;
                value += attn * attn * attn * attn * valuePart;
            }
        }
        const raw = value * NORM_2D
        return normalize 
            ? (raw + 1.0)*0.5
            : raw

    };
}
