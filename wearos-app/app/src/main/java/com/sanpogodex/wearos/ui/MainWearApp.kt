package com.sanpogodex.wearos.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.*
import com.sanpogodex.wearos.model.RotationData
import com.sanpogodex.wearos.network.RotationRepository
import kotlinx.coroutines.launch

@Composable
fun MainWearApp() {
    val repository = remember { RotationRepository() }
    val scope = rememberCoroutineScope()

    var rotationData by remember { mutableStateOf<RotationData?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var currentScreen by remember { mutableStateOf("home") }

    fun refreshData() {
        scope.launch {
            isLoading = true
            rotationData = repository.fetchActiveRotations()
            isLoading = false
        }
    }

    LaunchedEffect(Unit) {
        refreshData()
    }

    Scaffold(
        timeText = { TimeText() },
        vignette = { Vignette(vignettePosition = VignettePosition.TopAndBottom) }
    ) {
        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            val data = rotationData ?: RotationData()
            when (currentScreen) {
                "home" -> HomeScreen(
                    data = data,
                    onNavigate = { screen -> currentScreen = screen },
                    onRefresh = { refreshData() }
                )
                "raids" -> RaidsScreen(data.raids) { currentScreen = "home" }
                "events" -> EventsScreen(data.events) { currentScreen = "home" }
                "eggs" -> EggsScreen(data.eggs) { currentScreen = "home" }
                "promos" -> PromoCodesScreen(data.promoCodes) { currentScreen = "home" }
            }
        }
    }
}

@Composable
fun HomeScreen(
    data: RotationData,
    onNavigate: (String) -> Unit,
    onRefresh: () -> Unit
) {
    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        horizontalAlignment = Alignment.CenterHorizontally,
        contentPadding = PaddingValues(top = 28.dp, bottom = 28.dp, start = 10.dp, end = 10.dp)
    ) {
        item {
            Text(
                text = "San PoGodex",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFFFB703),
                modifier = Modifier.padding(bottom = 6.dp)
            )
        }

        item {
            Chip(
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                onClick = { onNavigate("raids") },
                label = { Text("Active Raids (${data.raids.size})") },
                secondaryLabel = { Text("Super Mega, 5★, Megas") },
                colors = ChipDefaults.chipColors(backgroundColor = Color(0xFF1E293B))
            )
        }

        item {
            Chip(
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                onClick = { onNavigate("events") },
                label = { Text("Active Events (${data.events.size})") },
                secondaryLabel = { Text("Events & Hours") },
                colors = ChipDefaults.chipColors(backgroundColor = Color(0xFF162E25))
            )
        }

        item {
            Chip(
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                onClick = { onNavigate("eggs") },
                label = { Text("Egg Pool (${data.eggs.size})") },
                secondaryLabel = { Text("2km, 5km, 10km, 12km") },
                colors = ChipDefaults.chipColors(backgroundColor = Color(0xFF2E1A16))
            )
        }

        item {
            Chip(
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                onClick = { onNavigate("promos") },
                label = { Text("Promo Codes (${data.promoCodes.size})") },
                secondaryLabel = { Text("Active rewards") },
                colors = ChipDefaults.chipColors(backgroundColor = Color(0xFF2C1E38))
            )
        }

        item {
            CompactChip(
                onClick = onRefresh,
                label = { Text("Refresh Data") },
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}
