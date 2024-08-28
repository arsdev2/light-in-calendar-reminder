import {createHash} from "crypto";

export function getHash(input: any) {
    return createHash('sha256').update(input).digest('hex');
}