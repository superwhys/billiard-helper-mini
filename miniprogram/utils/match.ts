import type { Match } from '../types/game'

export function snookerFrameWins(match: Match, playerId: number): number {
    if (!match.match_games) {
        return match.players.find(function (player) { return player.id === playerId })?.scores ?? 0
    }
    return match.match_games.filter(function (game) {
        return game.end_at && game.winner_id === playerId
    }).length
}
