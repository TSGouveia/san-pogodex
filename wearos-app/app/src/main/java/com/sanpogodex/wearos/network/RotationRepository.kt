package com.sanpogodex.wearos.network

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.sanpogodex.wearos.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class RotationRepository {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    private val RAIDS_URL = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/raids.json"
    private val EGGS_URL = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/eggs.json"
    private val EVENTS_URL = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json"
    private val PROMO_URL = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/promoCodes.json"

    suspend fun fetchActiveRotations(): RotationData = withContext(Dispatchers.IO) {
        val raids = fetchList<RaidBoss>(RAIDS_URL)
        val eggs = fetchList<EggBoss>(EGGS_URL)
        val events = fetchList<GameEvent>(EVENTS_URL)
        val promos = fetchList<PromoCodeItem>(PROMO_URL)

        RotationData(
            raids = raids,
            eggs = eggs,
            events = events,
            promoCodes = promos
        )
    }

    private inline fun <reified T> fetchList(url: String): List<T> {
        return try {
            val request = Request.Builder().url(url).build()
            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                val json = response.body?.string() ?: return emptyList()
                val type = object : TypeToken<List<T>>() {}.type
                gson.fromJson(json, type) ?: emptyList()
            } else emptyList()
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }
}
