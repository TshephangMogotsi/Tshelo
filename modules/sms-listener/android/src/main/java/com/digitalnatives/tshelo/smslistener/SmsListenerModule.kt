package com.digitalnatives.tshelo.smslistener

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Forwards incoming SMS to JS while the app process is alive. Detection
// while the app is fully killed would need a manifest-declared receiver +
// headless task — out of scope until the parser formats are confirmed.
class SmsListenerModule : Module() {
  private var receiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("SmsListener")

    Events("onSmsReceived")

    OnStartObserving {
      if (receiver != null) return@OnStartObserving
      val newReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
          if (intent?.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
          val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
          // Long SMS arrive as parts in one broadcast; stitch them per sender
          val bySender = messages.filterNotNull().groupBy { it.displayOriginatingAddress ?: "" }
          for ((sender, parts) in bySender) {
            sendEvent(
              "onSmsReceived",
              mapOf(
                "sender" to sender,
                "body" to parts.joinToString("") { it.displayMessageBody ?: "" },
              )
            )
          }
        }
      }
      val context = appContext.reactContext ?: return@OnStartObserving
      ContextCompat.registerReceiver(
        context,
        newReceiver,
        IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION),
        ContextCompat.RECEIVER_EXPORTED,
      )
      receiver = newReceiver
    }

    OnStopObserving {
      receiver?.let { appContext.reactContext?.unregisterReceiver(it) }
      receiver = null
    }
  }
}
