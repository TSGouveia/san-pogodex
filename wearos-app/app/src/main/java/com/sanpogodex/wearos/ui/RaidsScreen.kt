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
import com.sanpogodex.wearos.model.RaidBoss

@Composable
fun RaidsScreen(raids: List<RaidBoss>, onBack: () -> Unit) {
    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        horizontalAlignment = Alignment.CenterHorizontally,
        contentPadding = PaddingValues(top = 28.dp, bottom = 28.dp, start = 10.dp, end = 10.dp)
    ) {
        item {
            Text(
                text = "Active Raids",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFFFB703),
                modifier = Modifier.padding(bottom = 6.dp)
            )
        }

        if (raids.isEmpty()) {
            item {
                Text("No active raids found.", fontSize = 12.sp, color = Color.Gray)
            }
        } else {
            items(raids.size) { index ->
                val raid = raids[index]
                RaidCardItem(raid)
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
fun RaidCardItem(raid: RaidBoss) {
    val tierStr = raid.tier ?: "Raid"
    val tierColor = when {
        tierStr.contains("Super Mega", ignoreCase = true) -> Color(0xFFFB923C)
        tierStr.contains("Mega", ignoreCase = true) -> Color(0xFFF87171)
        tierStr.contains("Shadow", ignoreCase = true) -> Color(0xFFA78BFA)
        tierStr.contains("5", ignoreCase = true) -> Color(0xFFC084FC)
        else -> Color(0xFF60A5FA)
    }

    Card(
        onClick = {},
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        backgroundPainter = CardDefaults.cardBackgroundPainter(
            startBackgroundColor = Color(0xFF1E1E24),
            endBackgroundColor = Color(0xFF16161A)
        )
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (!raid.image.isNull_or_empty()) {
                AsyncImage(
                    model = raid.image,
                    contentDescription = raid.name,
                    modifier = Modifier
                        .size(36.dp)
                        .padding(end = 8.dp)
                )
            }
            Column {
                Text(
                    text = raid.name,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = tierStr,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = tierColor
                )
                if (raid.combatPower?.normal != null) {
                    Text(
                        text = "CP: ${raid.combatPower.normal.min}-${raid.combatPower.normal.max}",
                        fontSize = 9.sp,
                        color = Color.LightGray
                    )
                }
            }
        }
    }
}

private fun String?.isNull_or_empty(): Boolean = this.isNullOrEmpty()
