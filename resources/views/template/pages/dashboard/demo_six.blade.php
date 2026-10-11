@section('title',$title)
@section('description',$description)
@extends('template.layout.app')
@section('content')
<div class="crm demo6 mb-25">
    <div class="container-fluid">
        <div class="row ">
            <div class="col-lg-12">
                <div class="breadcrumb-main">
                    <h4 class="text-capitalize breadcrumb-title">{{ trans('page_title.dashboard') }}</h4>
                    <div class="breadcrumb-action justify-content-center flex-wrap">
                        <nav aria-label="breadcrumb">
                            <ol class="breadcrumb">
                                <li class="breadcrumb-item"><a href="#"><i class="uil uil-estate"></i>{{ trans('page_title.dashboard') }}</a></li>
                                <li class="breadcrumb-item active" aria-current="page">{{ trans('page_title.demo_six') }}</li>
                            </ol>
                        </nav>
                    </div>
                </div>
            </div>
            @include('template.components.dashboard.demo_six.overview_cards')
            @include('template.components.dashboard.demo_six.total_sales')
            @include('template.components.dashboard.demo_six.profile_growth')
            @include('template.components.dashboard.demo_six.sales_overview')
            @include('template.components.dashboard.demo_six.sales_location')
            @include('template.components.dashboard.demo_six.top_product')
            @include('template.components.dashboard.demo_one.browser_state')
                        
        </div>
    </div>
</div>
@endsection