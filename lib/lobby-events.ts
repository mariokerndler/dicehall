export function shouldHandleLobbyClosedEvent(currentLobbyCode: string | undefined, eventLobbyCode: string | undefined): boolean {
  return Boolean(currentLobbyCode && eventLobbyCode && currentLobbyCode === eventLobbyCode);
}
