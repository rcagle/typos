#include <stdio.h>
#include <unistd.h>
#include <util.h>

int my_fork(int *amaster, const char *path, char * const argv[], char *const envp[]) {
  int rval;

  rval = forkpty(amaster, NULL, NULL, NULL);
  if (rval == 0) {
    // Then this is the child process.
    rval = execve(path, argv, envp);
    return rval; // Only happens on error.
  } else if (rval > 0) {
    // This is the parent process. Return the child PID.
    return rval;
  } else {
    // Rval is < 0. Error.
    return rval;
  }
}
