import { accessSync, constants } from "fs";

/**
 * Checks if the a path exists.
 * @param path 
 * @returns `True` if the path exists,`False` if not.
 */
export function checkIfPathExists(path: string): boolean {
    try {
        accessSync(path, constants.R_OK | constants.W_OK);
        return true;
    }
    catch {
        return false;
    }
}

/**
 * Checks whether or not teh given string is a filepath or not.
 * @param commandOrPathString 
 * @returns `True` if the string points to a file,`False` if its not.
 */
export function pointsToFile(commandOrPathString: string | undefined): boolean {
    if (commandOrPathString) {
        return checkIfPathExists(commandOrPathString);
    }
    return false;
}