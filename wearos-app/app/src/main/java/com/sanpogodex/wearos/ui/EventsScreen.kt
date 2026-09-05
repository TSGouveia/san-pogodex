package com.sanpogodex.wearos.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.*
import coil.compose.AsyncImage
import com.sanpogodex.wearos.model.GameEvent

@Composable
fun EventsScreen(events: List<GameEvent>, onBack: () -> Unit) {
    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        horizontalAlignment = Alignment.CenterHorizontally,
        contentPadding = PaddingValues(top = 28.dp, bottom = 28.dp, start = 10.dp, end = 10.dp)
    ) {
        item {
            Text(
                text = "Active Events",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF34D399),
                modifier = Modifier.padding(bottom = 6.dp)
            )
        }

        if (events.isEmpty()) {
            item {
                Text("No active events found.", fontSize = 12.sp, color = Color.Gray)
            }
        } else {
            items(events.size) { index ->
                val event = events[index]
                EventCardItem(event)
            }
        }

        item {
            CompactChip(
                onClick = onBack,
                label = { Text("Back") },
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}

@Composable
fun EventCardItem(event: GameEvent) {
    Card(
        onClick = {},
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        backgroundPainter = CardDefaults.cardBackgroundPainter(
            startBackgroundColor = Color(0xFF064E3B),
            endBackgroundColor = Color(0xFF022C22)
        )
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (!event.image.isNullOrEmpty()) {
                AsyncImage(
                    model = event.image,
                    contentDescription = event.name,
                    modifier = Modifier
                        .size(32.dp)
                        .padding(end = 8.dp)
                )
            }
            Column {
                Text(
                    text = event.name,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                if (!event.heading.isNullOrEmpty()) {
                    Text(
                        text = event.heading,
                        fontSize = 10.sp,
                        color = Color(0xFFA7F3D0)
                    )
                }
            }
        }
    }
}
