export function shouldHandleLobbyClosedEvent(currentLobbyCode: string | undefined, eventLobbyCode: string | undefined): boolean {
  if (!currentLobbyCode || !eventLobbyCode) {
    return true;
  }

  return currentLobbyCode === eventLobbyCode;
}
