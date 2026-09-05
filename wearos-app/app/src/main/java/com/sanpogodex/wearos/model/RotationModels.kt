package com.sanpogodex.wearos.model

import com.google.gson.annotations.SerializedName

data class RaidBoss(
    val name: String,
    val tier: String?,
    val image: String?,
    val canBeShiny: Boolean? = false,
    val combatPower: CombatPower? = null
)

data class CombatPower(
    val normal: CpRange? = null,
    val boosted: CpRange? = null
)

data class CpRange(
    val min: Int = 0,
    val max: Int = 0
)

data class EggBoss(
    val name: String,
    val distance: String?,
    val image: String?,
    val canBeShiny: Boolean? = false
)

data class GameEvent(
    val name: String,
    val heading: String?,
    val details: String?,
    val image: String?,
    val start: String?,
    val end: String?
)

data class PromoCodeItem(
    val title: String?,
    val code: String?,
    val description: String?,
    val expires: String?,
    val rewards: List<String>? = emptyList()
)

data class RocketLineup(
    val name: String?,
    val title: String?,
    val pokemon: List<RocketPokemon>? = emptyList()
)

data class RocketPokemon(
    val name: String,
    val image: String? = null,
    val slot: Int = 1
)

data class RotationData(
    val raids: List<RaidBoss> = emptyList(),
    val eggs: List<EggBoss> = emptyList(),
    val events: List<GameEvent> = emptyList(),
    val promoCodes: List<PromoCodeItem> = emptyList()
)
