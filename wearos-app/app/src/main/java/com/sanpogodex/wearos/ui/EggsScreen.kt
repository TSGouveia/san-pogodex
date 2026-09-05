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
import com.sanpogodex.wearos.model.EggBoss

@Composable
fun EggsScreen(eggs: List<EggBoss>, onBack: () -> Unit) {
    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        horizontalAlignment = Alignment.CenterHorizontally,
        contentPadding = PaddingValues(top = 28.dp, bottom = 28.dp, start = 10.dp, end = 10.dp)
    ) {
        item {
            Text(
                text = "Egg Pool",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFF97316),
                modifier = Modifier.padding(bottom = 6.dp)
            )
        }

        if (eggs.isEmpty()) {
            item {
                Text("No egg pool data available.", fontSize = 12.sp, color = Color.Gray)
            }
        } else {
            items(eggs.size) { index ->
                val egg = eggs[index]
                EggCardItem(egg)
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
fun EggCardItem(egg: EggBoss) {
    Card(
        onClick = {},
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        backgroundPainter = CardDefaults.cardBackgroundPainter(
            startBackgroundColor = Color(0xFF451A03),
            endBackgroundColor = Color(0xFF290E02)
        )
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (!egg.image.isNullOrEmpty()) {
                AsyncImage(
                    model = egg.image,
                    contentDescription = egg.name,
                    modifier = Modifier
                        .size(32.dp)
                        .padding(end = 8.dp)
                )
            }
            Column {
                Text(
                    text = egg.name,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = egg.distance ?: "Egg",
                    fontSize = 10.sp,
                    color = Color(0xFFFDBA74)
                )
            }
        }
    }
}
