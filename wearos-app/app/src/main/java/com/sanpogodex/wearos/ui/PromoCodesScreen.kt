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
import com.sanpogodex.wearos.model.PromoCodeItem

@Composable
fun PromoCodesScreen(promos: List<PromoCodeItem>, onBack: () -> Unit) {
    ScalingLazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
        horizontalAlignment = Alignment.CenterHorizontally,
        contentPadding = PaddingValues(top = 28.dp, bottom = 28.dp, start = 10.dp, end = 10.dp)
    ) {
        item {
            Text(
                text = "Promo Codes",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFC084FC),
                modifier = Modifier.padding(bottom = 6.dp)
            )
        }

        if (promos.isEmpty()) {
            item {
                Text("No active promo codes found.", fontSize = 12.sp, color = Color.Gray)
            }
        } else {
            items(promos.size) { index ->
                val promo = promos[index]
                PromoCardItem(promo)
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
fun PromoCardItem(promo: PromoCodeItem) {
    val codeStr = promo.code ?: "???"
    val titleStr = promo.title ?: codeStr

    Card(
        onClick = {},
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        backgroundPainter = CardDefaults.cardBackgroundPainter(
            startBackgroundColor = Color(0xFF3B0764),
            endBackgroundColor = Color(0xFF2E1065)
        )
    ) {
        Column {
            Text(
                text = titleStr,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Text(
                text = "Code: $codeStr",
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = Color(0xFFFBBF24),
                modifier = Modifier.padding(top = 2.dp)
            )
        }
    }
}
