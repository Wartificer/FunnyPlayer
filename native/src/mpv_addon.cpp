#include <napi.h>
#include <mpv/client.h>
#include <mpv/render.h>
#include <atomic>
#include <vector>
#include <string>
#include <cstring>
#include <mutex>

class MpvPlayer : public Napi::ObjectWrap<MpvPlayer> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "MpvPlayer", {
            InstanceMethod("create", &MpvPlayer::Create),
            InstanceMethod("destroy", &MpvPlayer::Destroy),
            InstanceMethod("command", &MpvPlayer::Command),
            InstanceMethod("setOptionString", &MpvPlayer::SetOptionString),
            InstanceMethod("setPropertyDouble", &MpvPlayer::SetPropertyDouble),
            InstanceMethod("setPropertyBool", &MpvPlayer::SetPropertyBool),
            InstanceMethod("setPropertyString", &MpvPlayer::SetPropertyString),
            InstanceMethod("getPropertyDouble", &MpvPlayer::GetPropertyDouble),
            InstanceMethod("getPropertyBool", &MpvPlayer::GetPropertyBool),
            InstanceMethod("getPropertyString", &MpvPlayer::GetPropertyString),
            InstanceMethod("observeProperty", &MpvPlayer::ObserveProperty),
            InstanceMethod("setRenderSize", &MpvPlayer::SetRenderSize),
            InstanceMethod("renderFrame", &MpvPlayer::RenderFrame),
            InstanceMethod("processEvents", &MpvPlayer::ProcessEvents),
        });

        Napi::FunctionReference* constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);
        exports.Set("MpvPlayer", func);
        return exports;
    }

    MpvPlayer(const Napi::CallbackInfo& info) : Napi::ObjectWrap<MpvPlayer>(info) {}

    ~MpvPlayer() {
        cleanup();
    }

private:
    mpv_handle* mpv_ = nullptr;
    mpv_render_context* render_ctx_ = nullptr;
    std::atomic<bool> frame_ready_{false};

    // Frame buffer
    std::vector<uint8_t> frame_buffer_;
    int render_width_ = 0;
    int render_height_ = 0;

    // Property observation tracking
    std::mutex event_mutex_;

    void cleanup() {
        if (render_ctx_) {
            mpv_render_context_free(render_ctx_);
            render_ctx_ = nullptr;
        }
        if (mpv_) {
            mpv_terminate_destroy(mpv_);
            mpv_ = nullptr;
        }
        frame_buffer_.clear();
    }

    static void on_mpv_render_update(void* ctx) {
        auto self = static_cast<MpvPlayer*>(ctx);
        self->frame_ready_.store(true, std::memory_order_release);
    }

    // --- API Methods ---

    Napi::Value Create(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        mpv_ = mpv_create();
        if (!mpv_) {
            Napi::Error::New(env, "Failed to create mpv instance").ThrowAsJavaScriptException();
            return env.Undefined();
        }

        // Set default options for embedded playback
        mpv_set_option_string(mpv_, "vo", "libmpv");
        mpv_set_option_string(mpv_, "hwdec", "auto");
        mpv_set_option_string(mpv_, "keep-open", "yes");
        mpv_set_option_string(mpv_, "idle", "yes");
        mpv_set_option_string(mpv_, "osd-level", "0");
        mpv_set_option_string(mpv_, "sub-auto", "fuzzy");
        mpv_set_option_string(mpv_, "terminal", "no");

        int err = mpv_initialize(mpv_);
        if (err < 0) {
            std::string msg = "mpv_initialize failed: ";
            msg += mpv_error_string(err);
            mpv_terminate_destroy(mpv_);
            mpv_ = nullptr;
            Napi::Error::New(env, msg).ThrowAsJavaScriptException();
            return env.Undefined();
        }

        // Create software render context
        mpv_render_param params[] = {
            { MPV_RENDER_PARAM_API_TYPE,
              const_cast<char*>(MPV_RENDER_API_TYPE_SW) },
            { MPV_RENDER_PARAM_INVALID, nullptr }
        };

        err = mpv_render_context_create(&render_ctx_, mpv_, params);
        if (err < 0) {
            std::string msg = "mpv_render_context_create failed: ";
            msg += mpv_error_string(err);
            mpv_terminate_destroy(mpv_);
            mpv_ = nullptr;
            Napi::Error::New(env, msg).ThrowAsJavaScriptException();
            return env.Undefined();
        }

        mpv_render_context_set_update_callback(render_ctx_, on_mpv_render_update, this);

        return env.Undefined();
    }

    void Destroy(const Napi::CallbackInfo& info) {
        cleanup();
    }

    Napi::Value Command(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (!mpv_) return env.Undefined();

        uint32_t len = info.Length();
        std::vector<std::string> args_store(len);
        std::vector<const char*> args(len + 1);

        for (uint32_t i = 0; i < len; i++) {
            args_store[i] = info[i].As<Napi::String>().Utf8Value();
            args[i] = args_store[i].c_str();
        }
        args[len] = nullptr;

        int err = mpv_command(mpv_, args.data());
        if (err < 0) {
            std::string msg = "mpv_command failed: ";
            msg += mpv_error_string(err);
            Napi::Error::New(env, msg).ThrowAsJavaScriptException();
        }
        return env.Undefined();
    }

    Napi::Value SetOptionString(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (!mpv_) return env.Undefined();

        std::string name = info[0].As<Napi::String>().Utf8Value();
        std::string value = info[1].As<Napi::String>().Utf8Value();
        mpv_set_option_string(mpv_, name.c_str(), value.c_str());
        return env.Undefined();
    }

    Napi::Value SetPropertyDouble(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (!mpv_) return env.Undefined();

        std::string name = info[0].As<Napi::String>().Utf8Value();
        double value = info[1].As<Napi::Number>().DoubleValue();
        mpv_set_property(mpv_, name.c_str(), MPV_FORMAT_DOUBLE, &value);
        return env.Undefined();
    }

    Napi::Value SetPropertyBool(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (!mpv_) return env.Undefined();

        std::string name = info[0].As<Napi::String>().Utf8Value();
        int value = info[1].As<Napi::Boolean>().Value() ? 1 : 0;
        mpv_set_property(mpv_, name.c_str(), MPV_FORMAT_FLAG, &value);
        return env.Undefined();
    }

    Napi::Value SetPropertyString(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (!mpv_) return env.Undefined();

        std::string name = info[0].As<Napi::String>().Utf8Value();
        std::string value = info[1].As<Napi::String>().Utf8Value();
        const char* val = value.c_str();
        mpv_set_property(mpv_, name.c_str(), MPV_FORMAT_STRING, &val);
        return env.Undefined();
    }

    Napi::Value GetPropertyDouble(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (!mpv_) return Napi::Number::New(env, 0);

        std::string name = info[0].As<Napi::String>().Utf8Value();
        double value = 0;
        int err = mpv_get_property(mpv_, name.c_str(), MPV_FORMAT_DOUBLE, &value);
        if (err < 0) return env.Null();
        return Napi::Number::New(env, value);
    }

    Napi::Value GetPropertyBool(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (!mpv_) return Napi::Boolean::New(env, false);

        std::string name = info[0].As<Napi::String>().Utf8Value();
        int value = 0;
        int err = mpv_get_property(mpv_, name.c_str(), MPV_FORMAT_FLAG, &value);
        if (err < 0) return env.Null();
        return Napi::Boolean::New(env, value != 0);
    }

    Napi::Value GetPropertyString(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (!mpv_) return env.Null();

        std::string name = info[0].As<Napi::String>().Utf8Value();
        char* value = nullptr;
        int err = mpv_get_property(mpv_, name.c_str(), MPV_FORMAT_STRING, &value);
        if (err < 0 || !value) return env.Null();
        auto result = Napi::String::New(env, value);
        mpv_free(value);
        return result;
    }

    Napi::Value ObserveProperty(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (!mpv_) return env.Undefined();

        std::string name = info[0].As<Napi::String>().Utf8Value();
        std::string format = info[1].As<Napi::String>().Utf8Value();

        mpv_format fmt = MPV_FORMAT_NONE;
        if (format == "double") fmt = MPV_FORMAT_DOUBLE;
        else if (format == "bool") fmt = MPV_FORMAT_FLAG;
        else if (format == "string") fmt = MPV_FORMAT_STRING;

        mpv_observe_property(mpv_, 0, name.c_str(), fmt);
        return env.Undefined();
    }

    Napi::Value SetRenderSize(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        render_width_ = info[0].As<Napi::Number>().Int32Value();
        render_height_ = info[1].As<Napi::Number>().Int32Value();
        frame_buffer_.resize(render_width_ * render_height_ * 4);
        return env.Undefined();
    }

    Napi::Value RenderFrame(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();

        if (!render_ctx_ || render_width_ <= 0 || render_height_ <= 0 ||
            frame_buffer_.empty()) {
            return env.Null();
        }

        // Check if a new frame is available
        bool expected = true;
        if (!frame_ready_.compare_exchange_strong(expected, false,
                std::memory_order_acq_rel)) {
            return env.Null(); // No new frame
        }

        // Render to our buffer
        int w = render_width_;
        int h = render_height_;
        int stride = w * 4;
        int size[2] = { w, h };
        size_t stride_val = static_cast<size_t>(stride);
        const char* format = "rgb0";

        mpv_render_param params[] = {
            { MPV_RENDER_PARAM_SW_SIZE, size },
            { MPV_RENDER_PARAM_SW_FORMAT, const_cast<char*>(format) },
            { MPV_RENDER_PARAM_SW_STRIDE, &stride_val },
            { MPV_RENDER_PARAM_SW_POINTER, frame_buffer_.data() },
            { MPV_RENDER_PARAM_INVALID, nullptr }
        };

        int err = mpv_render_context_render(render_ctx_, params);
        if (err < 0) {
            return env.Null();
        }

        // Return a COPY of the frame buffer (WebGL requires owned ArrayBuffers)
        auto array_buffer = Napi::ArrayBuffer::New(env, frame_buffer_.size());
        memcpy(array_buffer.Data(), frame_buffer_.data(), frame_buffer_.size());
        return Napi::Uint8Array::New(env, frame_buffer_.size(),
            array_buffer, 0);
    }

    Napi::Value ProcessEvents(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (!mpv_) return Napi::Array::New(env, 0);

        Napi::Array events = Napi::Array::New(env);
        uint32_t idx = 0;

        while (true) {
            mpv_event* event = mpv_wait_event(mpv_, 0);
            if (event->event_id == MPV_EVENT_NONE) break;

            if (event->event_id == MPV_EVENT_PROPERTY_CHANGE) {
                mpv_event_property* prop =
                    static_cast<mpv_event_property*>(event->data);

                Napi::Object obj = Napi::Object::New(env);
                obj.Set("type", "property-change");
                obj.Set("name", Napi::String::New(env, prop->name));

                if (prop->format == MPV_FORMAT_DOUBLE && prop->data) {
                    obj.Set("data",
                        Napi::Number::New(env, *static_cast<double*>(prop->data)));
                } else if (prop->format == MPV_FORMAT_FLAG && prop->data) {
                    obj.Set("data",
                        Napi::Boolean::New(env, *static_cast<int*>(prop->data) != 0));
                } else if (prop->format == MPV_FORMAT_STRING && prop->data) {
                    obj.Set("data",
                        Napi::String::New(env, *static_cast<char**>(prop->data)));
                } else {
                    obj.Set("data", env.Null());
                }

                events.Set(idx++, obj);

            } else if (event->event_id == MPV_EVENT_END_FILE) {
                Napi::Object obj = Napi::Object::New(env);
                obj.Set("type", "end-file");
                obj.Set("name", "");
                obj.Set("data", env.Null());
                events.Set(idx++, obj);

            } else if (event->event_id == MPV_EVENT_FILE_LOADED) {
                Napi::Object obj = Napi::Object::New(env);
                obj.Set("type", "file-loaded");
                obj.Set("name", "");
                obj.Set("data", env.Null());
                events.Set(idx++, obj);
            }
        }

        return events;
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return MpvPlayer::Init(env, exports);
}

NODE_API_MODULE(mpv_player, Init)
