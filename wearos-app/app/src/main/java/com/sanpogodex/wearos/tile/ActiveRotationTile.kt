package com.sanpogodex.wearos.tile

import android.content.Context
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.material.Colors
import androidx.wear.protolayout.material.CompactChip
import androidx.wear.protolayout.material.Text
import androidx.wear.protolayout.material.Typography
import androidx.wear.protolayout.material.layouts.PrimaryLayout
import androidx.wear.tiles.EventBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

class ActiveRotationTile : TileService() {
    private val RESOURCES_VERSION = "1"

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        val layout = LayoutElementBuilders.Layout.Builder()
            .setRoot(
                PrimaryLayout.Builder(deviceParameters)
                    .setHeader(
                        Text.Builder(this, "San PoGodex")
                            .setTypography(Typography.TYPOGRAPHY_CAPTION1)
                            .setColor(Colors.PRIMARY)
                            .build()
                    )
                    .setContent(
                        Text.Builder(this, "Active Rotations\nRaids • Events • Eggs")
                            .setTypography(Typography.TYPOGRAPHY_BODY1)
                            .build()
                    )
                    .setPrimaryChipAction(
                        CompactChip.Builder(this, "Open App", androidx.wear.protolayout.ActionBuilders.launchAction(
                            android.content.ComponentName(packageName, "com.sanpogodex.wearos.MainActivity")
                        ), deviceParameters).build()
                    )
                    .build()
            )
            .build()

        val timeline = TimelineBuilders.Timeline.Builder()
            .addTimelineEntry(
                TimelineBuilders.TimelineEntry.Builder()
                    .setLayout(layout)
                    .build()
            )
            .build()

        val tile = TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setTileTimeline(timeline)
            .build()

        return Futures.immediateFuture(tile)
    }

    override fun onResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> {
        val resources = ResourceBuilders.Resources.Builder()
            .setVersion(RESOURCES_VERSION)
            .build()
        return Futures.immediateFuture(resources)
    }
}
